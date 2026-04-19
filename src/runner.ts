import type { Category } from "./categories/index.js";
import type { LLMConnector } from "./connectors/index.js";

export interface RunResult {
  connector: { provider: string; name: string };
  category: { id: string; name: string };
  caseId: string;
  caseDescription: string;
  pass: boolean;
  score: number;
  notes?: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  rawOutput?: string;
  error?: string;
}

export async function runBenchmark(
  connectors: LLMConnector[],
  categories: Category[],
): Promise<RunResult[]> {
  const results: RunResult[] = [];

  for (const category of categories) {
    const cases = await category.loadCases();
    console.log(`\n▷ ${category.name} — ${cases.length} cases`);

    for (const connector of connectors) {
      console.log(`  ${connector.provider}/${connector.name}`);
      for (const testCase of cases) {
        const { system, user } = category.buildPrompt(testCase);
        const entry: RunResult = {
          connector: { provider: connector.provider, name: connector.name },
          category: { id: category.id, name: category.name },
          caseId: testCase.id,
          caseDescription: testCase.description,
          pass: false,
          score: 0,
          latencyMs: 0,
        };

        try {
          const res = await connector.complete(user, { systemPrompt: system });
          entry.rawOutput = res.text;
          entry.latencyMs = res.latencyMs;
          entry.inputTokens = res.inputTokens;
          entry.outputTokens = res.outputTokens;
          const parsed = category.parseOutput(res.text);
          const scored = await category.score(testCase, parsed);
          entry.pass = scored.pass;
          entry.score = scored.score;
          entry.notes = scored.notes;
        } catch (err) {
          entry.error = err instanceof Error ? err.message : String(err);
        }

        const mark = entry.error ? "⚠" : entry.pass ? "✓" : "✗";
        const tail = entry.error ? ` — ERROR: ${entry.error}` : entry.notes ? ` — ${entry.notes}` : "";
        console.log(`    ${mark} ${testCase.id} (${entry.latencyMs}ms)${tail}`);
        results.push(entry);
      }
    }
  }

  return results;
}
