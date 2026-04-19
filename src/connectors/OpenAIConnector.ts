import OpenAI from "openai";
import type { CompleteOptions, LLMConnector, LLMResponse } from "./LLMConnector.js";

export type MaxTokensField = "max_tokens" | "max_completion_tokens";

export interface OpenAIConnectorOptions {
  model?: string;
  apiKey?: string;
  baseURL?: string;
  /** Override `provider` label (used by CLI filters and reports). */
  provider?: string;
  /**
   * Which request field to use when forwarding CompleteOptions.maxTokens.
   * Default is `max_completion_tokens` (required by recent OpenAI reasoning models).
   * OpenAI-compatible vendors (DeepSeek, Qwen, Kimi) expect `max_tokens`.
   */
  maxTokensField?: MaxTokensField;
  /** Label to use in the thrown error when the API key is missing. */
  apiKeyEnvName?: string;
}

/**
 * OpenAI chat.completions connector. Designed to be subclassed by vendors that
 * ship an OpenAI-compatible endpoint (DeepSeek, Qwen/DashScope, Kimi/Moonshot).
 */
export class OpenAIConnector implements LLMConnector {
  readonly provider: string;
  readonly name: string;
  protected readonly client: OpenAI;
  protected readonly maxTokensField: MaxTokensField;

  constructor(options: OpenAIConnectorOptions = {}) {
    const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const envName = options.apiKeyEnvName ?? "OPENAI_API_KEY";
      throw new Error(`${this.constructor.name}: ${envName} is not set`);
    }
    this.provider = options.provider ?? "openai";
    this.client = new OpenAI({ apiKey, ...(options.baseURL ? { baseURL: options.baseURL } : {}) });
    this.name = options.model ?? "gpt-5";
    this.maxTokensField = options.maxTokensField ?? "max_completion_tokens";
  }

  async complete(prompt: string, options: CompleteOptions = {}): Promise<LLMResponse> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    if (options.systemPrompt) messages.push({ role: "system", content: options.systemPrompt });
    messages.push({ role: "user", content: prompt });

    const body: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
      model: this.name,
      messages,
      stream: false,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options.maxTokens !== undefined ? { [this.maxTokensField]: options.maxTokens } : {}),
    };

    const start = Date.now();
    const completion = await this.client.chat.completions.create(body);

    const choice = completion.choices[0];
    return {
      text: choice?.message?.content ?? "",
      inputTokens: completion.usage?.prompt_tokens,
      outputTokens: completion.usage?.completion_tokens,
      latencyMs: Date.now() - start,
    };
  }
}
