import { writeFile } from "node:fs/promises";
import type { RunResult } from "./runner.js";

export interface LatencyStats {
  avgMs: number;
  p50Ms: number;
  maxMs: number;
  sampleSize: number; // successful (non-error) runs only
}

export interface OverallRow {
  model: string;
  count: number;
  passRate: number;
  errorCount: number;
  latency: LatencyStats;
  totalInputTokens: number;
  totalOutputTokens: number;
  avgTokensPerCase: { input: number; output: number };
}

export interface CategoryRow {
  category: string;
  categoryName: string;
  rows: Array<{
    model: string;
    count: number;
    passRate: number;
    latency: LatencyStats;
  }>;
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

  const overall: OverallRow[] = [...byModel.entries()].map(([model, rs]) => {
    const successful = rs.filter((r) => !r.error);
    const errors = rs.length - successful.length;
    const totalInput = rs.reduce((s, r) => s + (r.inputTokens ?? 0), 0);
    const totalOutput = rs.reduce((s, r) => s + (r.outputTokens ?? 0), 0);
    return {
      model,
      count: rs.length,
      passRate: rs.filter((r) => r.pass).length / rs.length,
      errorCount: errors,
      latency: latencyStats(successful.map((r) => r.latencyMs)),
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      avgTokensPerCase: {
        input: rs.length ? totalInput / rs.length : 0,
        output: rs.length ? totalOutput / rs.length : 0,
      },
    };
  });

  const perCategory: CategoryRow[] = [...byCategory.entries()].map(([id, bucket]) => ({
    category: id,
    categoryName: bucket.name,
    rows: [...bucket.byModel.entries()].map(([model, rs]) => {
      const successful = rs.filter((r) => !r.error);
      return {
        model,
        count: rs.length,
        passRate: rs.filter((r) => r.pass).length / rs.length,
        latency: latencyStats(successful.map((r) => r.latencyMs)),
      };
    }),
  }));

  return { overall, perCategory };
}

function latencyStats(samplesMs: number[]): LatencyStats {
  if (samplesMs.length === 0) {
    return { avgMs: 0, p50Ms: 0, maxMs: 0, sampleSize: 0 };
  }
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  const p50 = percentile(sorted, 0.5);
  const max = sorted[sorted.length - 1] ?? 0;
  return { avgMs: avg, p50Ms: p50, maxMs: max, sampleSize: sorted.length };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx] ?? 0;
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
  .charts-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
  @media (max-width: 820px) { .charts-2col { grid-template-columns: 1fr; } }
  table { border-collapse: collapse; width: 100%; font-size: .88rem; margin: 1rem 0; }
  th, td { border: 1px solid #ddd; padding: .4rem .55rem; text-align: left; vertical-align: top; }
  th { background: #f4f4f6; position: sticky; top: 0; }
  tr.pass td:first-child { color: #0a7a2f; font-weight: 600; }
  tr.fail td:first-child { color: #b8001b; font-weight: 600; }
  tr.err  td:first-child { color: #a07000; font-weight: 600; }
  details > summary { cursor: pointer; color: #2255aa; }
  pre { white-space: pre-wrap; background: #f7f7f9; padding: .5rem; border-radius: 4px; margin: .25rem 0; font-size: .78rem; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
</style>
</head>
<body>
<h1>Agentic BPM Benchmark</h1>
<p class="meta">Generated ${escapeHtml(new Date().toISOString())} · ${results.length} runs · ${models.length} model(s) · ${categoryCount} categor${categoryCount === 1 ? "y" : "ies"}</p>

<h2>Quality &amp; speed by model</h2>
<div class="charts-2col">
  <div class="chart"><canvas id="overall"></canvas></div>
  <div class="chart"><canvas id="latency"></canvas></div>
</div>

<h2>Quality vs. speed</h2>
<p class="meta">Each point is one model. Top-left is best (high pass rate, low latency). Latency excludes error rows.</p>
<div class="chart"><canvas id="scatter"></canvas></div>

<h2>Per category</h2>
<div class="charts-2col">
  <div class="chart"><canvas id="perCategoryPass"></canvas></div>
  <div class="chart"><canvas id="perCategoryLatency"></canvas></div>
</div>

<h2>Model summary</h2>
<table>
<thead><tr>
  <th>Model</th><th class="num">Pass rate</th><th class="num">Errors</th>
  <th class="num">Avg ms</th><th class="num">p50 ms</th><th class="num">Max ms</th>
  <th class="num">Tokens in (total)</th><th class="num">Tokens out (total)</th>
  <th class="num">Avg tokens/case (in/out)</th>
</tr></thead>
<tbody>
${summary.overall.map((row) => `<tr>
  <td>${escapeHtml(row.model)}</td>
  <td class="num">${(row.passRate * 100).toFixed(1)}%</td>
  <td class="num">${row.errorCount}</td>
  <td class="num">${row.latency.avgMs.toFixed(0)}</td>
  <td class="num">${row.latency.p50Ms.toFixed(0)}</td>
  <td class="num">${row.latency.maxMs.toFixed(0)}</td>
  <td class="num">${row.totalInputTokens}</td>
  <td class="num">${row.totalOutputTokens}</td>
  <td class="num">${row.avgTokensPerCase.input.toFixed(0)} / ${row.avgTokensPerCase.output.toFixed(0)}</td>
</tr>`).join("\n")}
</tbody></table>

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
const pctAxis = { beginAtZero: true, max: 1, ticks: { callback: v => (v * 100).toFixed(0) + "%" } };

// Overall pass rate
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
    plugins: { legend: { display: false }, title: { display: true, text: "Pass rate" } },
    scales: { y: pctAxis }
  }
});

// Overall avg latency
new Chart(document.getElementById("latency"), {
  type: "bar",
  data: {
    labels: summary.overall.map(o => o.model),
    datasets: [{
      label: "Avg latency (ms)",
      data: summary.overall.map(o => Math.round(o.latency.avgMs)),
      backgroundColor: summary.overall.map((_, i) => palette[i % palette.length]),
    }]
  },
  options: {
    plugins: { legend: { display: false }, title: { display: true, text: "Average latency (ms, non-error runs)" } },
    scales: { y: { beginAtZero: true } }
  }
});

// Quality vs. speed scatter
new Chart(document.getElementById("scatter"), {
  type: "scatter",
  data: {
    datasets: summary.overall.map((o, i) => ({
      label: o.model,
      data: [{ x: o.latency.avgMs, y: o.passRate }],
      backgroundColor: palette[i % palette.length],
      pointRadius: 8,
      pointHoverRadius: 10,
    })),
  },
  options: {
    plugins: {
      tooltip: {
        callbacks: {
          label: ctx => ctx.dataset.label + ": " + (ctx.parsed.y * 100).toFixed(1) + "% @ " + Math.round(ctx.parsed.x) + "ms"
        }
      }
    },
    scales: {
      x: { title: { display: true, text: "Avg latency (ms, non-error)" }, beginAtZero: true },
      y: { title: { display: true, text: "Pass rate" }, ...pctAxis }
    }
  }
});

// Per-category pass rate
const categoryLabels = summary.perCategory.map(c => c.categoryName);
const allModels = [...new Set(summary.perCategory.flatMap(c => c.rows.map(r => r.model)))];
new Chart(document.getElementById("perCategoryPass"), {
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
    plugins: { title: { display: true, text: "Pass rate per category" } },
    scales: { y: pctAxis }
  }
});

// Per-category avg latency
new Chart(document.getElementById("perCategoryLatency"), {
  type: "bar",
  data: {
    labels: categoryLabels,
    datasets: allModels.map((m, i) => ({
      label: m,
      backgroundColor: palette[i % palette.length],
      data: summary.perCategory.map(c => {
        const row = c.rows.find(r => r.model === m);
        return row ? Math.round(row.latency.avgMs) : 0;
      })
    }))
  },
  options: {
    plugins: { title: { display: true, text: "Avg latency per category (ms)" } },
    scales: { y: { beginAtZero: true } }
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
  <td class="num">${r.latencyMs}ms</td>
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
