import type { BenchmarkCase, Category, ScoreResult } from "./Category.js";
import { DataMappingCategory } from "./DataMapping.js";
import { TransitionConditionCategory } from "./TransitionCondition.js";

const ALL: Category[] = [new TransitionConditionCategory(), new DataMappingCategory()];

export const KNOWN_CATEGORIES = ALL.map((c) => c.id);

export function availableCategories(ids?: string[]): Category[] {
  if (!ids || ids.length === 0) return ALL;
  const filter = new Set(ids.map((i) => i.toLowerCase()));
  for (const id of filter) {
    if (!KNOWN_CATEGORIES.includes(id)) {
      throw new Error(`Unknown category "${id}". Known: ${KNOWN_CATEGORIES.join(", ")}`);
    }
  }
  return ALL.filter((c) => filter.has(c.id));
}

export type { BenchmarkCase, Category, ScoreResult };
