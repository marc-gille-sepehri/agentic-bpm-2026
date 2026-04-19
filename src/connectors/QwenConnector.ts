import { OpenAIConnector } from "./OpenAIConnector.js";

export interface QwenConnectorOptions {
  model?: string;
  apiKey?: string;
  /** Override base URL; defaults to the Alibaba Cloud International endpoint. */
  baseURL?: string;
}

/**
 * Qwen via Alibaba DashScope (international compatible-mode endpoint by default).
 * For mainland China, set DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1.
 */
export class QwenConnector extends OpenAIConnector {
  constructor(options: QwenConnectorOptions = {}) {
    const apiKey = options.apiKey ?? process.env.DASHSCOPE_API_KEY;
    const baseURL =
      options.baseURL ??
      process.env.DASHSCOPE_BASE_URL ??
      "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
    super({
      apiKey,
      baseURL,
      model: options.model ?? "qwen3-max",
      provider: "qwen",
      maxTokensField: "max_tokens",
      apiKeyEnvName: "DASHSCOPE_API_KEY",
    });
  }
}
