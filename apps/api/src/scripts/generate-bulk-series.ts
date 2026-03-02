import "dotenv/config";
import { prisma } from "../prisma";
import { generateProgressiveSessionSeries } from "../services/session-progressive";
import { saveSeriesToVault } from "../services/vault";
import type { SessionPromptInput } from "../prompts/session";

type Args = {
  count: number;
  sessionsPerSeries: number;
  delayMs: number;
  dryRun: boolean;
  stopOnError: boolean;
  maxRetries: number;
  retryDelayMs: number;
};

function getArgValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function hasArg(flag: string): boolean {
  return process.argv.includes(flag);
}

function parseArgs(): Args {
  const count = Number(getArgValue("--count") || process.env.BULK_SERIES_COUNT || 20);
  const sessionsPerSeries = Number(getArgValue("--sessionsPerSeries") || process.env.BULK_SESSIONS_PER_SERIES || 3);
  const delayMs = Number(getArgValue("--delayMs") || process.env.BULK_DELAY_MS || 0);
  const dryRun = hasArg("--dryRun") || process.env.BULK_DRY_RUN === "1";
  const stopOnError = hasArg("--stopOnError") || process.env.BULK_STOP_ON_ERROR === "1";
  const maxRetries = Number(getArgValue("--maxRetries") || process.env.BULK_SERIES_MAX_RETRIES || 1);
  const retryDelayMs = Number(getArgValue("--retryDelayMs") || process.env.BULK_SERIES_RETRY_DELAY_MS || 5000);

  return {
    count: Number.isFinite(count) && count > 0 ? count : 20,
    sessionsPerSeries: Number.isFinite(sessionsPerSeries) && sessionsPerSeries >= 2 && sessionsPerSeries <= 10
      ? sessionsPerSeries
      : 3,
    delayMs: Number.isFinite(delayMs) && delayMs >= 0 ? delayMs : 0,
    dryRun,
    stopOnError,
    maxRetries: Number.isFinite(maxRetries) && maxRetries >= 0 ? Math.floor(maxRetries) : 1,
    retryDelayMs: Number.isFinite(retryDelayMs) && retryDelayMs >= 0 ? retryDelayMs : 5000,
  };
}

const gameModels = ["POSSESSION", "PRESSING", "TRANSITION", "COACHAI", "ROCKLIN_FC"];
const ageGroups = ["U8", "U9", "U10", "U11", "U12", "U13", "U14", "U15", "U16"];
const phases = ["ATTACKING", "DEFENDING", "TRANSITION"];
const zones = ["DEFENSIVE_THIRD", "MIDDLE_THIRD", "ATTACKING_THIRD"];
const formationsAttacking = ["2-3-1", "3-2-1", "4-3-3", "4-2-3-1"];
const formationsDefending = ["3-2-1", "4-4-2", "4-1-4-1", "4-3-3"];
const playerLevels = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
const coachLevels = ["GRASSROOTS", "USSF_C", "USSF_B_PLUS"];
const spaceConstraints = ["THIRD", "HALF", "FULL", "QUARTER"];
const durations = [60, 90];
const numbersMinOptions = [8, 10, 12];
const numbersMaxOptions = [12, 14, 16, 18];
const goalsAvailableOptions = [1, 2];

function pick<T>(list: T[], seed: number): T {
  return list[seed % list.length];
}

function buildInput(seed: number): SessionPromptInput {
  const numbersMin = pick(numbersMinOptions, seed);
  let numbersMax = pick(numbersMaxOptions, seed + 3);
  if (numbersMax <= numbersMin) {
    numbersMax = numbersMin + 2;
  }

  return {
    gameModelId: pick(gameModels, seed),
    ageGroup: pick(ageGroups, seed + 1),
    phase: pick(phases, seed + 2),
    zone: pick(zones, seed + 3),
    formationAttacking: pick(formationsAttacking, seed + 4),
    formationDefending: pick(formationsDefending, seed + 5),
    playerLevel: pick(playerLevels, seed + 6),
    coachLevel: pick(coachLevels, seed + 7),
    spaceConstraint: pick(spaceConstraints, seed + 8),
    durationMin: pick(durations, seed + 9),
    numbersMin,
    numbersMax,
    goalsAvailable: pick(goalsAvailableOptions, seed + 10),
  };
}

async function sleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const { count, sessionsPerSeries, delayMs, dryRun, stopOnError, maxRetries, retryDelayMs } = parseArgs();
  console.log(`[BULK SERIES] Starting generation for ${count} series`);
  console.log(
    `[BULK SERIES] sessionsPerSeries=${sessionsPerSeries} delayMs=${delayMs} dryRun=${dryRun} stopOnError=${stopOnError} maxRetries=${maxRetries} retryDelayMs=${retryDelayMs}`
  );

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY missing in .env");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL missing in .env");
  }

  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;

  let success = 0;
  let failed = 0;

  for (let i = 0; i < count; i++) {
    const input = buildInput(i);
    const seriesId = `series-${Date.now()}-${i}`;
    console.log(`[BULK SERIES] (${i + 1}/${count}) Generating series`, {
      seriesId,
      gameModelId: input.gameModelId,
      ageGroup: input.ageGroup,
      phase: input.phase,
      zone: input.zone,
      formationAttacking: input.formationAttacking,
      formationDefending: input.formationDefending,
      durationMin: input.durationMin,
    });

    let attempt = 0;
    let completed = false;

    while (!completed && attempt <= maxRetries) {
      try {
        attempt += 1;
        if (dryRun) {
          console.log(`[BULK SERIES] Dry run: skipping generation`);
          completed = true;
          success += 1;
        } else {
          console.log(`[BULK SERIES] Attempt ${attempt}/${maxRetries + 1}`);
          const result = await generateProgressiveSessionSeries(input, sessionsPerSeries);
          const sessionIds = (result.series || []).map((s) => s.id).filter(Boolean) as string[];
          if (sessionIds.length === 0) {
            throw new Error("No session IDs returned from progressive series generation");
          }
          await saveSeriesToVault(seriesId, sessionIds);
          console.log(`[BULK SERIES] Saved series to vault: ${seriesId} (${sessionIds.length} sessions)`);
          success += 1;
          completed = true;
        }
      } catch (err: any) {
        console.error(`[BULK SERIES] Failed to generate series ${i + 1} (attempt ${attempt}):`, err?.message || err);
        if (err?.stack) {
          console.error(err.stack);
        }
        console.error("[BULK SERIES] Input that failed:", input);

        if (attempt > maxRetries) {
          failed += 1;
          if (stopOnError) {
            throw err;
          }
        } else {
          console.log(`[BULK SERIES] Retrying after ${retryDelayMs}ms...`);
          await sleep(retryDelayMs);
        }
      }
    }

    await sleep(delayMs);
  }

  console.log(`[BULK SERIES] Completed. success=${success} failed=${failed}`);
}

main()
  .catch((err) => {
    console.error("[BULK SERIES] Fatal error:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
