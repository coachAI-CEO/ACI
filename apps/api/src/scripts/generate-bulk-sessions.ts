import "dotenv/config";
import { generateAndReviewSession } from "../services/session";
import { saveSessionToVault } from "../services/vault";
import type { SessionPromptInput } from "../prompts/session";
import { prisma } from "../prisma";

type Args = {
  count: number;
  delayMs: number;
  dryRun: boolean;
  stopOnError: boolean;
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
  const count = Number(getArgValue("--count") || process.env.BULK_COUNT || 100);
  const delayMs = Number(getArgValue("--delayMs") || process.env.BULK_DELAY_MS || 0);
  const dryRun = hasArg("--dryRun") || process.env.BULK_DRY_RUN === "1";
  const stopOnError = hasArg("--stopOnError") || process.env.BULK_STOP_ON_ERROR === "1";

  return {
    count: Number.isFinite(count) && count > 0 ? count : 100,
    delayMs: Number.isFinite(delayMs) && delayMs >= 0 ? delayMs : 0,
    dryRun,
    stopOnError,
  };
}

const gameModels = ["POSSESSION", "PRESSING", "TRANSITION", "COACHAI", "ROCKLIN_FC"];
const ageGroups = ["U10", "U11", "U12", "U13", "U14", "U15"];
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
  const { count, delayMs, dryRun, stopOnError } = parseArgs();
  console.log(`[BULK] Starting bulk generation for ${count} sessions`);
  console.log(`[BULK] delayMs=${delayMs} dryRun=${dryRun} stopOnError=${stopOnError}`);

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
    console.log(`[BULK] (${i + 1}/${count}) Generating session`, {
      gameModelId: input.gameModelId,
      ageGroup: input.ageGroup,
      phase: input.phase,
      zone: input.zone,
      formationAttacking: input.formationAttacking,
      formationDefending: input.formationDefending,
      durationMin: input.durationMin,
    });

    try {
      if (dryRun) {
        console.log(`[BULK] Dry run: skipping generation`);
      } else {
        const result = await generateAndReviewSession(input);
        const sessionId = result?.raw?.created?.id || result?.session?.id;
        if (!sessionId) {
          throw new Error("Missing session ID from generation result");
        }
        await saveSessionToVault(sessionId);
        console.log(`[BULK] Saved to vault: ${sessionId}`);
        success += 1;
      }
    } catch (err: any) {
      failed += 1;
      console.error(`[BULK] Failed to generate session ${i + 1}:`, err?.message || err);
      if (err?.stack) {
        console.error(err.stack);
      }
      console.error("[BULK] Input that failed:", input);
      if (stopOnError) {
        throw err;
      }
    }

    await sleep(delayMs);
  }

  console.log(`[BULK] Completed. success=${success} failed=${failed}`);
}

main()
  .catch((err) => {
    console.error("[BULK] Fatal error:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
