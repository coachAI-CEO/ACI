import "../../config/load-env";
import fs from "fs";
import path from "path";
import { runScenario } from "./harness";
import { SCENARIOS } from "./scenarios";
import { SANDBOX_ALLOWED_MODELS } from "./pricing";

/**
 * Reusable head-to-head model sandbox.
 *
 * Runs one real production prompt (session generation, description
 * expansion, ...) against a list of candidate models in parallel and
 * reports latency, token usage, estimated cost, and a scenario-specific
 * validity check side by side. Add a new comparison by adding an entry to
 * scenarios.ts -- everything else (cost math, table, JSON dump) is shared.
 *
 * Usage:
 *   pnpm --filter api sandbox:models -- --scenario session
 *   pnpm --filter api sandbox:models -- --scenario description --models gemini-3.5-flash-lite,gemini-2.5-flash-lite
 *   pnpm --filter api sandbox:models -- --scenario session --force --models gemini-3.5-flash
 *
 * gemini-3.5-flash and gemini-3.6-flash (non-lite) are banned as defaults --
 * $21.5 and $76.5 in a single day's spend versus $1.24/$1.29 combined for
 * the lite variants doing the same job (see gemini.ts). Pass --force to run
 * a non-lite model anyway for a deliberate one-off comparison.
 */

function getArgValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function parseListArg(flag: string, fallback: string[]): string[] {
  const raw = getArgValue(flag);
  if (!raw) return fallback;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

async function main() {
  const scenarioName = getArgValue("--scenario") || "session";
  const scenario = SCENARIOS[scenarioName];
  if (!scenario) {
    console.error(`Unknown scenario "${scenarioName}". Available: ${Object.keys(SCENARIOS).join(", ")}`);
    process.exit(1);
  }

  const models = parseListArg("--models", SANDBOX_ALLOWED_MODELS);
  const force = process.argv.includes("--force");
  const blocked = models.filter((m) => !SANDBOX_ALLOWED_MODELS.includes(m));
  if (blocked.length && !force) {
    console.error(
      `Refusing to run non-lite/unlisted model(s) [${blocked.join(", ")}] without --force. ` +
        `Allowed by default: ${SANDBOX_ALLOWED_MODELS.join(", ")}`
    );
    process.exit(1);
  }

  console.log(`\nRunning scenario "${scenario.name}" against: ${models.join(", ")}\n`);

  const reasoningEffort = getArgValue("--reasoningEffort") as "none" | "minimal" | "low" | "medium" | "high" | undefined;

  const { prompt, results } = await runScenario(scenario, models, {
    timeout: Number(getArgValue("--timeoutMs") || 45000),
    reasoningEffort,
  });

  const rows = results.map((r) => ({
    model: r.model,
    ok: r.ok,
    latencyMs: r.durationMs ?? "-",
    promptTokens: r.promptTokens ?? "-",
    completionTokens: r.completionTokens ?? "-",
    estCostUsd: r.estCostUsd != null ? `$${r.estCostUsd.toFixed(5)}` : "-",
    valid: r.validation ? (r.validation.ok ? "yes" : "no") : "-",
    note: r.validation?.note ?? r.error ?? "-",
  }));
  console.table(rows);

  const outDir = getArgValue("--outDir") || path.join(process.cwd(), "src/scripts/model-sandbox/results");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${scenario.name}-${Date.now()}.json`);
  fs.writeFileSync(
    outPath,
    JSON.stringify({ scenario: scenario.name, prompt, ranAt: new Date().toISOString(), results }, null, 2)
  );
  console.log(`\nFull output (including generated text) written to ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
