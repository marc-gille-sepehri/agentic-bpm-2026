import type { CompleteOptions, LLMConnector, LLMResponse } from "./LLMConnector.js";

export interface QwenConnectorOptions {
  model?: string;
  apiKey?: string;
}

/**
 * Qwen via Alibaba DashScope. Native endpoint is OpenAI-compatible at
 * https://dashscope-intl.aliyuncs.com/compatible-mode/v1 — you can use the
 * `openai` SDK with baseURL set to that URL and API key = DASHSCOPE_API_KEY.
 */
export class QwenConnector implements LLMConnector {
  readonly provider = "qwen";
  readonly name: string;

  constructor(options: QwenConnectorOptions = {}) {
    this.name = options.model ?? "qwen3-max";
    throw new Error(
      "QwenConnector not yet implemented. Use DashScope (OpenAI-compatible) endpoint with DASHSCOPE_API_KEY.",
    );
  }

  async complete(_prompt: string, _options?: CompleteOptions): Promise<LLMResponse> {
    throw new Error("QwenConnector.complete not yet implemented");
  }
}
