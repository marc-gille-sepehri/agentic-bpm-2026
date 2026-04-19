import Anthropic from "@anthropic-ai/sdk";
import type { CompleteOptions, LLMConnector, LLMResponse } from "./LLMConnector.js";

export interface AnthropicConnectorOptions {
  model?: string;
  apiKey?: string;
}

export class AnthropicConnector implements LLMConnector {
  readonly provider = "anthropic";
  readonly name: string;
  private readonly client: Anthropic;

  constructor(options: AnthropicConnectorOptions = {}) {
    const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("AnthropicConnector: ANTHROPIC_API_KEY is not set");
    }
    this.client = new Anthropic({ apiKey });
    this.name = options.model ?? "claude-opus-4-7";
  }

  async complete(prompt: string, options: CompleteOptions = {}): Promise<LLMResponse> {
    const start = Date.now();
    const msg = await this.client.messages.create({
      model: this.name,
      max_tokens: options.maxTokens ?? 2048,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options.systemPrompt ? { system: options.systemPrompt } : {}),
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content
      .filter((block): block is Extract<typeof block, { type: "text" }> => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return {
      text,
      inputTokens: msg.usage?.input_tokens,
      outputTokens: msg.usage?.output_tokens,
      latencyMs: Date.now() - start,
    };
  }
}
