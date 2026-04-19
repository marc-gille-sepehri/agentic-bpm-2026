import { OpenAIConnector } from "./OpenAIConnector.js";

export interface DeepSeekConnectorOptions {
  model?: string;
  apiKey?: string;
}

/**
 * DeepSeek (https://api.deepseek.com) speaks OpenAI's chat.completions wire
 * protocol, so we reuse OpenAIConnector with a different baseURL and API key.
 */
export class DeepSeekConnector extends OpenAIConnector {
  constructor(options: DeepSeekConnectorOptions = {}) {
    const apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY;
    super({
      apiKey,
      baseURL: "https://api.deepseek.com",
      model: options.model ?? "deepseek-reasoner",
      provider: "deepseek",
      maxTokensField: "max_tokens",
      apiKeyEnvName: "DEEPSEEK_API_KEY",
    });
  }
}
