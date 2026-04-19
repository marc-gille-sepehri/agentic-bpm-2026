import type { CompleteOptions, LLMConnector, LLMResponse } from "./LLMConnector.js";

export interface KimiConnectorOptions {
  model?: string;
  apiKey?: string;
}

/**
 * Kimi (Moonshot AI) API is OpenAI-compatible at https://api.moonshot.ai/v1.
 * Use the `openai` SDK with apiKey = MOONSHOT_API_KEY.
 */
export class KimiConnector implements LLMConnector {
  readonly provider = "kimi";
  readonly name: string;

  constructor(options: KimiConnectorOptions = {}) {
    this.name = options.model ?? "kimi-k2";
    throw new Error(
      "KimiConnector not yet implemented. Use Moonshot's OpenAI-compatible endpoint at https://api.moonshot.ai/v1.",
    );
  }

  async complete(_prompt: string, _options?: CompleteOptions): Promise<LLMResponse> {
    throw new Error("KimiConnector.complete not yet implemented");
  }
}
