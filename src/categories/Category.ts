export interface BenchmarkCase {
  id: string;
  description: string;
  dataPool: unknown;
  expected: unknown;
}

export interface ScoreResult {
  pass: boolean;
  score: number;
  notes?: string;
}

export interface Category<
  TCase extends BenchmarkCase = BenchmarkCase,
  TOutput = unknown,
> {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  loadCases(): Promise<TCase[]>;
  buildPrompt(testCase: TCase): { system: string; user: string };
  parseOutput(raw: string): TOutput;
  score(testCase: TCase, output: TOutput): Promise<ScoreResult>;
}
