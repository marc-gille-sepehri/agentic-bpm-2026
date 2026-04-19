import type { CompleteOptions, LLMConnector, LLMResponse } from "./LLMConnector.js";

export interface GoogleConnectorOptions {
  model?: string;
  apiKey?: string;
}

export class GoogleConnector implements LLMConnector {
  readonly provider = "google";
  readonly name: string;

  constructor(options: GoogleConnectorOptions = {}) {
    this.name = options.model ?? "gemini-2.5-pro";
    throw new Error(
      "GoogleConnector not yet implemented. Install `@google/genai` and call client.models.generateContent.",
    );
  }

  async complete(_prompt: string, _options?: CompleteOptions): Promise<LLMResponse> {
    throw new Error("GoogleConnector.complete not yet implemented");
  }
}
