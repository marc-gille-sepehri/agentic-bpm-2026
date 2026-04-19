export interface LLMConnector {
  readonly provider: string;
  readonly name: string;
  complete(prompt: string, options?: CompleteOptions): Promise<LLMResponse>;
}

export interface CompleteOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
}
