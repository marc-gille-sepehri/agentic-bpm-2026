import "dotenv/config";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { KNOWN_CATEGORIES, availableCategories } from "./categories/index.js";
import { KNOWN_PROVIDERS, availableConnectors } from "./connectors/index.js";
import { summarize, writeHtmlReport, writeJsonResults } from "./report.js";
import { runBenchmark } from "./runner.js";

interface CliArgs {
  providers?: string[];
  categories?: string[];
  model?: string;
  list: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { list: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const [flag, inlineValue] = arg.includes("=") ? arg.split(/=(.*)/s) : [arg, undefined];
    const takeValue = (): string => {
      if (inlineValue !== undefined) return inlineValue;
      const next = argv[++i];
      if (next === undefined) throw new Error(`Missing value for ${flag}`);
      return next;
    };
    switch (flag) {
      case "--connector":
      case "--connectors":
      case "--provider":
        args.providers = takeValue().split(",").map((s) => s.trim()).filter(Boolean);
        break;
      case "--category":
      case "--categories":
        args.categories = takeValue().split(",").map((s) => s.trim()).filter(Boolean);
        break;
      case "--model":
        args.model = takeValue();
        break;
      case "--list":
        args.list = true;
        break;
      case "-h":
      case "--help":
        args.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${flag}`);
    }
  }
  return args;
}

function printHelp(): void {
  console.log(`Usage: npm run bench -- [options]

Options:
  --connector <name[,name...]>   Run only these providers (default: all configured).
                                 Known: ${KNOWN_PROVIDERS.join(", ")}
  --category  <id[,id...]>       Run only these categories (default: all).
                                 Known: ${KNOWN_CATEGORIES.join(", ")}
  --model <name>                 Override model for the selected connector (only valid
                                 when --connector selects a single provider).
  --list                         Print available connectors/categories and exit.
  -h, --help                     Show this help.

Examples:
  npm run bench -- --connector anthropic
  npm run bench -- --connector anthropic --model claude-sonnet-4-6
  npm run bench -- --connector anthropic,openai --category transition-condition`);
}

async function main(): Promise<void> {
  let args: CliArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    printHelp();
    process.exit(2);
  }

  if (args.help) {
    printHelp();
    return;
  }

  if (args.model && (!args.providers || args.providers.length !== 1)) {
    console.error("--model requires exactly one --connector to be selected.");
    process.exit(2);
  }

  if (args.model && args.providers && args.providers[0]) {
    const envKey = `${args.providers[0].toUpperCase()}_MODEL`;
    process.env[envKey] = args.model;
  }

  if (args.list) {
    console.log(`Known connectors: ${KNOWN_PROVIDERS.join(", ")}`);
    console.log(`Known categories: ${KNOWN_CATEGORIES.join(", ")}`);
    return;
  }

  console.log("Loading connectors...");
  const connectors = availableConnectors(args.providers);
  if (connectors.length === 0) {
    const hint = args.providers
      ? `none of [${args.providers.join(", ")}] could be instantiated — check API keys`
      : "set at least one API key in .env (e.g. ANTHROPIC_API_KEY)";
    console.error(`No connectors available. ${hint}.`);
    process.exit(1);
  }
  for (const c of connectors) console.log(`  ✓ ${c.provider}/${c.name}`);

  console.log("\nLoading categories...");
  const categories = availableCategories(args.categories);
  for (const c of categories) console.log(`  ✓ ${c.id} — ${c.name}`);

  const results = await runBenchmark(connectors, categories);

  await mkdir("results", { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await writeJsonResults(path.join("results", `run-${stamp}.json`), results);
  await writeHtmlReport("report.html", results);

  console.log("\n=== Summary ===");
  for (const row of summarize(results).overall) {
    console.log(
      `  ${row.model}: ${(row.passRate * 100).toFixed(1)}% pass (${row.count} cases, avg ${row.avgLatencyMs.toFixed(0)}ms)`,
    );
  }
  console.log("\nWrote results/run-*.json and report.html");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
