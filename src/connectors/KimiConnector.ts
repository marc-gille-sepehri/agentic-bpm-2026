import { OpenAIConnector } from "./OpenAIConnector.js";

export interface KimiConnectorOptions {
  model?: string;
  apiKey?: string;
  /** Override base URL; defaults to the Moonshot International endpoint. */
  baseURL?: string;
}

/**
 * Kimi (Moonshot AI). International endpoint by default; set
 * MOONSHOT_BASE_URL=https://api.moonshot.cn/v1 for the mainland account.
 */
export class KimiConnector extends OpenAIConnector {
  constructor(options: KimiConnectorOptions = {}) {
    const apiKey = options.apiKey ?? process.env.MOONSHOT_API_KEY;
    const baseURL = options.baseURL ?? process.env.MOONSHOT_BASE_URL ?? "https://api.moonshot.ai/v1";
    super({
      apiKey,
      baseURL,
      model: options.model ?? "kimi-latest",
      provider: "kimi",
      maxTokensField: "max_tokens",
      apiKeyEnvName: "MOONSHOT_API_KEY",
    });
  }
}
