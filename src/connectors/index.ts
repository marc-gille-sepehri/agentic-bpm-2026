import { AnthropicConnector } from "./AnthropicConnector.js";
import { DeepSeekConnector } from "./DeepSeekConnector.js";
import { GoogleConnector } from "./GoogleConnector.js";
import { KimiConnector } from "./KimiConnector.js";
import type { LLMConnector } from "./LLMConnector.js";
import { OpenAIConnector } from "./OpenAIConnector.js";
import { QwenConnector } from "./QwenConnector.js";

type Factory = { label: string; build: () => LLMConnector };

const FACTORIES: Factory[] = [
  { label: "anthropic", build: () => new AnthropicConnector({ model: process.env.ANTHROPIC_MODEL }) },
  { label: "openai", build: () => new OpenAIConnector({ model: process.env.OPENAI_MODEL }) },
  { label: "google", build: () => new GoogleConnector({ model: process.env.GOOGLE_MODEL }) },
  { label: "qwen", build: () => new QwenConnector({ model: process.env.QWEN_MODEL }) },
  { label: "deepseek", build: () => new DeepSeekConnector({ model: process.env.DEEPSEEK_MODEL }) },
  { label: "kimi", build: () => new KimiConnector({ model: process.env.KIMI_MODEL }) },
];

/** Known provider labels — useful for CLI help and validation. */
export const KNOWN_PROVIDERS = FACTORIES.map((f) => f.label);

/**
 * Instantiates each configured connector, quietly skipping any that throw.
 * If `providers` is given, only those labels are considered (others are ignored entirely).
 */
export function availableConnectors(providers?: string[]): LLMConnector[] {
  const filter = providers && providers.length > 0 ? new Set(providers.map((p) => p.toLowerCase())) : undefined;
  if (filter) {
    for (const p of filter) {
      if (!KNOWN_PROVIDERS.includes(p)) {
        throw new Error(`Unknown connector "${p}". Known: ${KNOWN_PROVIDERS.join(", ")}`);
      }
    }
  }

  const out: LLMConnector[] = [];
  for (const factory of FACTORIES) {
    if (filter && !filter.has(factory.label)) continue;
    try {
      out.push(factory.build());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ⊘ ${factory.label} skipped — ${msg}`);
    }
  }
  return out;
}

export type { CompleteOptions, LLMConnector, LLMResponse } from "./LLMConnector.js";
