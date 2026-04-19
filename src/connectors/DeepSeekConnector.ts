import type { CompleteOptions, LLMConnector, LLMResponse } from "./LLMConnector.js";

export interface DeepSeekConnectorOptions {
  model?: string;
  apiKey?: string;
}

/**
 * DeepSeek API (https://api.deepseek.com) is OpenAI-compatible. Drop in the
 * `openai` SDK with baseURL = "https://api.deepseek.com" and apiKey = DEEPSEEK_API_KEY.
 */
export class DeepSeekConnector implements LLMConnector {
  readonly provider = "deepseek";
  readonly name: string;

  constructor(options: DeepSeekConnectorOptions = {}) {
    this.name = options.model ?? "deepseek-reasoner";
    throw new Error(
      "DeepSeekConnector not yet implemented. Use DeepSeek's OpenAI-compatible endpoint at https://api.deepseek.com.",
    );
  }

  async complete(_prompt: string, _options?: CompleteOptions): Promise<LLMResponse> {
    throw new Error("DeepSeekConnector.complete not yet implemented");
  }
}
