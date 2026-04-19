import { GoogleGenAI } from "@google/genai";
import type { CompleteOptions, LLMConnector, LLMResponse } from "./LLMConnector.js";

export interface GoogleConnectorOptions {
  model?: string;
  apiKey?: string;
}

export class GoogleConnector implements LLMConnector {
  readonly provider = "google";
  readonly name: string;
  private readonly client: GoogleGenAI;

  constructor(options: GoogleConnectorOptions = {}) {
    const apiKey = options.apiKey ?? process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("GoogleConnector: GOOGLE_API_KEY is not set");
    }
    this.client = new GoogleGenAI({ apiKey });
    this.name = options.model ?? "gemini-2.5-pro";
  }

  async complete(prompt: string, options: CompleteOptions = {}): Promise<LLMResponse> {
    const start = Date.now();
    const response = await this.client.models.generateContent({
      model: this.name,
      contents: prompt,
      config: {
        ...(options.systemPrompt ? { systemInstruction: options.systemPrompt } : {}),
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
        ...(options.maxTokens !== undefined ? { maxOutputTokens: options.maxTokens } : {}),
      },
    });

    const usage = response.usageMetadata;
    return {
      text: response.text ?? "",
      inputTokens: usage?.promptTokenCount,
      outputTokens: usage?.candidatesTokenCount,
      latencyMs: Date.now() - start,
    };
  }
}
