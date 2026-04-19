import jsonata from "jsonata";

/**
 * Evaluate a JSONata expression against the given data pool.
 * JSONata supports path access (`foo.bar`), filters (`items[price>10]`),
 * aggregates (`$sum`, `$average`, `$min`, `$max`, `$count`),
 * arithmetic/comparison, and `and`/`or`/`not` logic.
 */
export async function evaluateExpression(expr: string, dataPool: unknown): Promise<unknown> {
  const expression = jsonata(expr);
  return await expression.evaluate(dataPool);
}
