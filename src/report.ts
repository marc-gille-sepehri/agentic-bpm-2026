import { writeFile } from "node:fs/promises";
import type { RunResult } from "./runner.js";

export interface OverallRow {
  model: string;
  passRate: number;
  avgLatencyMs: number;
  count: number;
}

export interface CategoryRow {
  category: string;
  categoryName: string;
  rows: Array<{ model: string; passRate: number; count: number }>;
}

export interface Summary {
  overall: OverallRow[];
  perCategory: CategoryRow[];
}

export function summarize(results: RunResult[]): Summary {
  const byModel = new Map<string, RunResult[]>();
  const byCategory = new Map<string, { name: string; byModel: Map<string, RunResult[]> }>();

  for (const r of results) {
    const model = `${r.connector.provider}/${r.connector.name}`;

    const modelBucket = byModel.get(model) ?? [];
    modelBucket.push(r);
    byModel.set(model, modelBucket);

    const catBucket = byCategory.get(r.category.id) ?? { name: r.category.name, byModel: new Map() };
    const perModel = catBucket.byModel.get(model) ?? [];
    perModel.push(r);
    catBucket.byModel.set(model, perModel);
    byCategory.set(r.category.id, catBucket);
  }

  const overall: OverallRow[] = [...byModel.entries()].map(([model, rs]) => ({
    model,
    passRate: rs.filter((r) => r.pass).length / rs.length,
    avgLatencyMs: rs.reduce((s, r) => s + r.latencyMs, 0) / rs.length,
    count: rs.length,
  }));

  const perCategory: CategoryRow[] = [...byCategory.entries()].map(([id, bucket]) => ({
    category: id,
    categoryName: bucket.name,
    rows: [...bucket.byModel.entries()].map(([model, rs]) => ({
      model,
      passRate: rs.filter((r) => r.pass).length / rs.length,
      count: rs.length,
    })),
  }));

  return { overall, perCategory };
}

export async function writeJsonResults(path: string, results: RunResult[]): Promise<void> {
  await writeFile(path, JSON.stringify(results, null, 2), "utf8");
}

export async function writeHtmlReport(path: string, results: RunResult[]): Promise<void> {
  await writeFile(path, renderHtml(results, summarize(results)), "utf8");
}

function renderHtml(results: RunResult[], summary: Summary): string {
  const models = summary.overall.map((o) => o.model);
  const categoryCount = summary.perCategory.length;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Agentic BPM Benchmark</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
  body { font-family: system-ui, sans-serif; max-width: 1100px; margin: 2rem auto; padding: 0 1rem; color: #222; }
  h1 { margin-top: 0; }
  .meta { color: #666; font-size: .9rem; }
  .chart { max-width: 760px; margin: 1.25rem 0; }
  table { border-collapse: collapse; width: 100%; font-size: .88rem; margin: 1rem 0; }
  th, td { border: 1px solid #ddd; padding: .4rem .55rem; text-align: left; vertical-align: top; }
  th { background: #f4f4f6; position: sticky; top: 0; }
  tr.pass td:first-child { color: #0a7a2f; font-weight: 600; }
  tr.fail td:first-child { color: #b8001b; font-weight: 600; }
  tr.err  td:first-child { color: #a07000; font-weight: 600; }
  details > summary { cursor: pointer; color: #2255aa; }
  pre { white-space: pre-wrap; background: #f7f7f9; padding: .5rem; border-radius: 4px; margin: .25rem 0; font-size: .78rem; }
</style>
</head>
<body>
<h1>Agentic BPM Benchmark</h1>
<p class="meta">Generated ${escapeHtml(new Date().toISOString())} · ${results.length} runs · ${models.length} model(s) · ${categoryCount} categor${categoryCount === 1 ? "y" : "ies"}</p>

<h2>Overall pass rate</h2>
<div class="chart"><canvas id="overall"></canvas></div>

<h2>Pass rate per category</h2>
<div class="chart"><canvas id="perCategory"></canvas></div>

<h2>All runs</h2>
<table>
<thead><tr>
  <th>Status</th><th>Model</th><th>Category</th><th>Case</th>
  <th>Latency</th><th>Tokens (in/out)</th><th>Notes</th><th>Output</th>
</tr></thead>
<tbody>
${results.map(renderRow).join("\n")}
</tbody></table>

<script>
const summary = ${JSON.stringify(summary)};
const palette = ["#3366cc","#dc3912","#ff9900","#109618","#990099","#0099c6","#dd4477","#66aa00"];

new Chart(document.getElementById("overall"), {
  type: "bar",
  data: {
    labels: summary.overall.map(o => o.model),
    datasets: [{
      label: "Pass rate",
      data: summary.overall.map(o => o.passRate),
      backgroundColor: summary.overall.map((_, i) => palette[i % palette.length]),
    }]
  },
  options: {
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, max: 1, ticks: { callback: v => (v * 100).toFixed(0) + "%" } } }
  }
});

const categoryLabels = summary.perCategory.map(c => c.categoryName);
const allModels = [...new Set(summary.perCategory.flatMap(c => c.rows.map(r => r.model)))];
new Chart(document.getElementById("perCategory"), {
  type: "bar",
  data: {
    labels: categoryLabels,
    datasets: allModels.map((m, i) => ({
      label: m,
      backgroundColor: palette[i % palette.length],
      data: summary.perCategory.map(c => {
        const row = c.rows.find(r => r.model === m);
        return row ? row.passRate : 0;
      })
    }))
  },
  options: {
    scales: { y: { beginAtZero: true, max: 1, ticks: { callback: v => (v * 100).toFixed(0) + "%" } } }
  }
});
</script>
</body>
</html>`;
}

function renderRow(r: RunResult): string {
  const status = r.error ? "ERR" : r.pass ? "PASS" : "FAIL";
  const cls = r.error ? "err" : r.pass ? "pass" : "fail";
  const tokens = r.inputTokens !== undefined || r.outputTokens !== undefined
    ? `${r.inputTokens ?? "?"}/${r.outputTokens ?? "?"}`
    : "";
  return `<tr class="${cls}">
  <td>${status}</td>
  <td>${escapeHtml(r.connector.provider)}/${escapeHtml(r.connector.name)}</td>
  <td>${escapeHtml(r.category.name)}</td>
  <td><strong>${escapeHtml(r.caseId)}</strong><br/><small>${escapeHtml(r.caseDescription)}</small></td>
  <td>${r.latencyMs}ms</td>
  <td>${escapeHtml(tokens)}</td>
  <td>${escapeHtml(r.notes ?? r.error ?? "")}</td>
  <td><details><summary>show</summary><pre>${escapeHtml(r.rawOutput ?? "")}</pre></details></td>
</tr>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
