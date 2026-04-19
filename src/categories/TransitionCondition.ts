import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { evaluateExpression } from "../expression/evaluate.js";
import type { BenchmarkCase, Category, ScoreResult } from "./Category.js";

export interface TransitionCase extends BenchmarkCase {
  dataPool: Record<string, unknown>;
  condition: string;
  expected: { value: boolean };
}

export interface TransitionOutput {
  result?: boolean;
  expression?: string;
  reasoning?: string;
}

const SYSTEM_PROMPT = `You are an evaluator for agentic BPM workflow transitions. Given a data pool (JSON) and a transition condition in natural language, decide whether the condition is TRUE or FALSE.

You may answer in either of two equivalent ways:
1) "result": a direct boolean — best for subjective/textual judgements (e.g. sentiment, confirmation intent).
2) "expression": a JSONata expression that, when evaluated against the data pool, yields the boolean — best for numeric/aggregate conditions.

JSONata cheat sheet:
  - Path access:     foo.bar       items[0].price
  - Aggregates:      $sum(x)       $average(x)   $count(x)   $min(x)   $max(x)
  - Filter arrays:   items[category = 'food']    forecast[rain = true]
  - Arithmetic/cmp:  + - * /       >  <  =  !=  >=  <=
  - Logic:           and  or  not

Respond with a SINGLE JSON object, no prose outside it, matching:
{"result": true | false, "expression"?: "<JSONata>", "reasoning"?: "<short>"}

If you provide an expression, also supply the best "result" from mentally evaluating it. Always include a boolean "result".`;

export class TransitionConditionCategory implements Category<TransitionCase, TransitionOutput> {
  readonly id = "transition-condition";
  readonly name = "Transition Condition Evaluation";
  readonly description = "Assess whether a workflow transition condition holds against a semantic data pool.";

  private readonly casesDir: string;

  constructor(casesDir = "benchmarks/transition-condition") {
    this.casesDir = casesDir;
  }

  async loadCases(): Promise<TransitionCase[]> {
    const entries = await readdir(this.casesDir);
    const files = entries.filter((f) => f.endsWith(".json")).sort();
    const cases: TransitionCase[] = [];
    for (const file of files) {
      const content = await readFile(path.join(this.casesDir, file), "utf8");
      cases.push(JSON.parse(content) as TransitionCase);
    }
    return cases;
  }

  buildPrompt(testCase: TransitionCase): { system: string; user: string } {
    const user = `Condition: ${testCase.condition}

Data pool:
${JSON.stringify(testCase.dataPool, null, 2)}`;
    return { system: SYSTEM_PROMPT, user };
  }

  parseOutput(raw: string): TransitionOutput {
    const parsed = extractJson(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as TransitionOutput;
  }

  async score(testCase: TransitionCase, output: TransitionOutput): Promise<ScoreResult> {
    const expected = testCase.expected.value;

    let observed: boolean | undefined;
    let via: "direct" | "expression" | "none" = "none";
    let exprError: string | undefined;

    if (output.expression) {
      try {
        const evalResult = await evaluateExpression(output.expression, testCase.dataPool);
        const asBool = toBool(evalResult);
        if (asBool !== undefined) {
          observed = asBool;
          via = "expression";
        }
      } catch (err) {
        exprError = err instanceof Error ? err.message : String(err);
      }
    }

    if (observed === undefined && typeof output.result === "boolean") {
      observed = output.result;
      via = "direct";
    }

    if (observed === undefined) {
      const note = exprError ? `no usable output (expression error: ${exprError})` : "no usable output";
      return { pass: false, score: 0, notes: note };
    }

    const pass = observed === expected;
    const exprNote = exprError ? ` (expression error: ${exprError})` : "";
    return {
      pass,
      score: pass ? 1 : 0,
      notes: `observed=${observed} expected=${expected} via=${via}${exprNote}`,
    };
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

function toBool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  return undefined;
}
