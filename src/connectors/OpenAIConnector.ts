import type { CompleteOptions, LLMConnector, LLMResponse } from "./LLMConnector.js";

export interface OpenAIConnectorOptions {
  model?: string;
  apiKey?: string;
}

export class OpenAIConnector implements LLMConnector {
  readonly provider = "openai";
  readonly name: string;

  constructor(options: OpenAIConnectorOptions = {}) {
    this.name = options.model ?? "gpt-5";
    throw new Error(
      "OpenAIConnector not yet implemented. Install `openai` SDK and call client.responses.create (or chat.completions.create).",
    );
  }

  async complete(_prompt: string, _options?: CompleteOptions): Promise<LLMResponse> {
    throw new Error("OpenAIConnector.complete not yet implemented");
  }
}
