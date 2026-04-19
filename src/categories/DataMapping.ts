import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { evaluateExpression } from "../expression/evaluate.js";
import type { BenchmarkCase, Category, ScoreResult } from "./Category.js";

export interface PoolVariable {
  name: string;
  value: unknown;
  schema: unknown;
}

export interface DataPool {
  variables: PoolVariable[];
}

export interface ToolSpec {
  name: string;
  description: string;
  /** Parameter name → JSON-Schema-ish descriptor. */
  parameters: Record<string, { type?: string; description?: string; format?: string; [k: string]: unknown }>;
}

export interface DataMappingCase extends BenchmarkCase {
  dataPool: DataPool;
  tool: ToolSpec;
  expected: { mappings: Record<string, unknown> };
}

export interface DataMappingOutput {
  mappings?: Record<string, string>;
  reasoning?: string;
}

const SYSTEM_PROMPT = `You are a data-mapping agent for an agentic BPM engine.

You receive:
  1. A data pool: named variables, each with a current value and a JSON schema.
  2. A tool spec: parameters the tool expects (each with a JSON-schema-style descriptor).

For every tool parameter, produce a JSONata expression that, when evaluated against the
pool, yields the exact value to pass to the tool.

The pool is exposed to the evaluator as a FLAT object keyed by variable name.
For example, write "building.street" -- NOT "variables[name='building'].value.street".

Rules:
  - PREFER structured paths when the data is available in a pool variable
    (e.g. "building.street & ' ' & building.streetNumber").
  - Use STRING or NUMBER LITERALS (valid JSONata -- single-quoted strings like
    'DEU', 'Germany', or numeric literals like 42) when the required value is
    only mentioned in free-form text (a conversation) and no structured path exists.
    Do NOT write bare identifiers for literal strings -- JSONata will treat them as paths.
  - Apply small transformations inline:
      string concat with &                e.g. building.city & ', ' & 'Germany'
      substring                           $substring(str, start, len)
      ternary                             expr ? 'then' : 'else'
      country-code conversions as constants when needed ('DEU' for DE, etc.)
  - Aggregates over time series:          $sum, $average, $min, $max, $count
  - Filters / predicates:                 weather[conditions = 'rain']
  - Negative array indexing is supported: weather[-1] is the last element.

Respond with a SINGLE JSON object, no prose outside it, matching this schema:
  {"mappings": {"<parameterName>": "<jsonata-expression-as-string>", ...}}

Every parameter from the tool spec must appear in "mappings".`;

export class DataMappingCategory implements Category<DataMappingCase, DataMappingOutput> {
  readonly id = "data-mapping";
  readonly name = "Data Mapping";
  readonly description = "Map a semantic data pool to structured tool inputs via JSONata expressions.";

  private readonly casesDir: string;

  constructor(casesDir = "benchmarks/data-mapping") {
    this.casesDir = casesDir;
  }

  async loadCases(): Promise<DataMappingCase[]> {
    const poolRaw = await readFile(path.join(this.casesDir, "_pool.json"), "utf8");
    const pool = JSON.parse(poolRaw) as DataPool;

    const entries = await readdir(this.casesDir);
    const files = entries.filter((f) => f.endsWith(".json") && !f.startsWith("_")).sort();
    const cases: DataMappingCase[] = [];
    for (const file of files) {
      const raw = await readFile(path.join(this.casesDir, file), "utf8");
      const parsed = JSON.parse(raw) as Omit<DataMappingCase, "dataPool"> & { dataPool?: DataPool };
      cases.push({ ...parsed, dataPool: parsed.dataPool ?? pool });
    }
    return cases;
  }

  buildPrompt(testCase: DataMappingCase): { system: string; user: string } {
    const poolView = testCase.dataPool.variables.map((v) => ({
      name: v.name,
      value: v.value,
      schema: v.schema,
    }));
    const paramLines = Object.entries(testCase.tool.parameters)
      .map(([name, schema]) => `  - ${name}: ${JSON.stringify(schema)}`)
      .join("\n");

    const user = `Pool (${testCase.dataPool.variables.length} variables):
${JSON.stringify(poolView, null, 2)}

Tool: ${testCase.tool.name}
${testCase.tool.description}

Parameters:
${paramLines}`;

    return { system: SYSTEM_PROMPT, user };
  }

  parseOutput(raw: string): DataMappingOutput {
    const parsed = extractJson(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as DataMappingOutput;
  }

  async score(testCase: DataMappingCase, output: DataMappingOutput): Promise<ScoreResult> {
    const pool = Object.fromEntries(testCase.dataPool.variables.map((v) => [v.name, v.value]));
    const mappings = output.mappings ?? {};
    const expected = testCase.expected.mappings;
    const paramNames = Object.keys(expected);

    let correct = 0;
    const bad: string[] = [];
    const missing: string[] = [];

    for (const paramName of paramNames) {
      const expr = mappings[paramName];
      if (typeof expr !== "string") {
        missing.push(paramName);
        continue;
      }
      let observed: unknown;
      try {
        observed = await evaluateExpression(expr, pool);
      } catch (err) {
        bad.push(`${paramName}(eval:${errMessage(err)})`);
        continue;
      }
      if (valuesEqual(observed, expected[paramName])) {
        correct++;
      } else {
        bad.push(`${paramName}(got:${short(observed)})`);
      }
    }

    const total = paramNames.length;
    const score = total > 0 ? correct / total : 0;
    const pass = correct === total;
    const noteParts: string[] = [`${correct}/${total} correct`];
    if (missing.length) noteParts.push(`missing: ${missing.join(",")}`);
    if (bad.length) noteParts.push(`wrong: ${bad.join("; ")}`);
    return { pass, score, notes: noteParts.join(" | ") };
  }
}

function extractJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    // fall through
  }
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced && fenced[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // fall through
    }
  }
  const braced = raw.match(/\{[\s\S]*\}/);
  if (braced) {
    try {
      return JSON.parse(braced[0]);
    } catch {
      // fall through
    }
  }
  return undefined;
}

function valuesEqual(observed: unknown, expected: unknown): boolean {
  if (observed === expected) return true;
  if (typeof observed === "number" && typeof expected === "number") {
    return Math.abs(observed - expected) < 1e-3;
  }
  if (typeof observed === "string" && typeof expected === "string") {
    return observed === expected;
  }
  if (observed !== null && expected !== null && typeof observed === "object" && typeof expected === "object") {
    try {
      return JSON.stringify(observed) === JSON.stringify(expected);
    } catch {
      return false;
    }
  }
  return false;
}

function errMessage(err: unknown): string {
  // JSONata throws plain objects with { code, position, token, message }, not Error instances.
  if (err instanceof Error) return err.message.split("\n")[0] ?? err.message;
  if (err && typeof err === "object") {
    const e = err as { message?: unknown; code?: unknown; token?: unknown; position?: unknown };
    if (typeof e.message === "string") return e.message;
    const parts: string[] = [];
    if (e.code) parts.push(String(e.code));
    if (e.token !== undefined) parts.push(`token=${e.token}`);
    if (e.position !== undefined) parts.push(`pos=${e.position}`);
    if (parts.length) return parts.join(" ");
  }
  return String(err);
}

function short(v: unknown): string {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (s === undefined) return "undefined";
  return s.length > 40 ? s.slice(0, 37) + "..." : s;
}
