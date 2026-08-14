/**
 * Generate vaulted sessions as the three Rocklin pilot coaches and schedule
 * them Tue/Thu through next month (America/Los_Angeles).
 *
 * Usage (from apps/api):
 *   pnpm seed:pilot-calendar
 *   pnpm seed:pilot-calendar -- --apply
 *
 * Dry-run (default): prints planned writes, no Gemini calls.
 */
import "../config/load-env";
import { prisma } from "../prisma";
import { generateAndReviewSession } from "../services/session";
import { canGenerateSessions } from "../services/access-permissions";
import { incrementUsage } from "../services/auth";
import {
  philosophyHasContent,
  resolveClubSessionScope,
} from "../services/club-philosophy";
import { getGameModelTemplatePhilosophy } from "../services/game-model-templates";
import type { SessionPromptInput } from "../prompts/session";

const APPLY = process.argv.includes("--apply");
const TIME_ZONE = "America/Los_Angeles";
const PRACTICE_HOUR = 17;
const PRACTICE_MINUTE = 30;
const COACH_EMAILS = [
  "7v7.coach@rocklinfc.org",
  "9v9.coach@rocklinfc.org",
  "11v11.coach@rocklinfc.org",
] as const;

const PHASES = [
  { phase: "ATTACKING", zone: "ATTACKING_THIRD" },
  { phase: "DEFENDING", zone: "DEFENSIVE_THIRD" },
  { phase: "TRANSITION", zone: "MIDDLE_THIRD" },
] as const;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function nextMonth(from: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "numeric",
  }).formatToParts(from);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  if (month === 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pacificOffset(year: number, month: number): string {
  // Rough DST: PDT Mar–Nov, PST Dec–Feb. September is PDT.
  return month >= 3 && month <= 11 ? "-07:00" : "-08:00";
}

function practiceDate(year: number, month: number, day: number): Date {
  return new Date(
    `${year}-${pad(month)}-${pad(day)}T${pad(PRACTICE_HOUR)}:${pad(PRACTICE_MINUTE)}:00${pacificOffset(year, month)}`
  );
}

function weekdayShort(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: TIME_ZONE,
  }).format(date);
}

function trainingDates(year: number, month: number): Date[] {
  const dates: Date[] = [];
  const last = daysInMonth(year, month);
  for (let day = 1; day <= last; day++) {
    const date = practiceDate(year, month, day);
    const weekday = weekdayShort(date);
    if (weekday === "Tue" || weekday === "Thu") dates.push(date);
  }
  return dates;
}

function formationsForAge(ageGroup: string): { att: string; def: string } {
  if (ageGroup === "U8" || ageGroup === "U9" || ageGroup === "U10") {
    return { att: "2-3-1", def: "3-2-1" };
  }
  if (ageGroup === "U11" || ageGroup === "U12") {
    return { att: "3-2-3", def: "3-3-2" };
  }
  return { att: "4-3-3", def: "4-2-3-1" };
}

function numbersForAge(ageGroup: string): { min: number; max: number } {
  if (ageGroup === "U8" || ageGroup === "U9" || ageGroup === "U10") {
    return { min: 12, max: 14 };
  }
  if (ageGroup === "U11" || ageGroup === "U12") {
    return { min: 14, max: 18 };
  }
  return { min: 16, max: 22 };
}

function representativeAge(ageGroups: string[]): string {
  if (ageGroups.includes("U10")) return "U10";
  if (ageGroups.includes("U12")) return "U12";
  if (ageGroups.includes("U14")) return "U14";
  return ageGroups[Math.floor(ageGroups.length / 2)] || "U12";
}

async function sleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateForCoach(
  userId: string,
  email: string,
  input: SessionPromptInput,
  attempt = 1
): Promise<{ id: string; title: string; refCode: string | null; clubId: string | null }> {
  console.log(`[pilot-calendar] generate ${email} ${input.ageGroup} ${input.phase} attempt=${attempt}`);
  const result = await generateAndReviewSession(input, userId);
  const id = result?.raw?.created?.id || result?.session?.id;
  if (!id) throw new Error("Missing session ID from generation result");
  await incrementUsage(userId, "session");
  const saved = await prisma.session.findUnique({
    where: { id },
    select: { id: true, title: true, refCode: true, clubId: true, savedToVault: true },
  });
  if (!saved) throw new Error(`Session ${id} not found after create`);
  return saved;
}

async function main() {
  console.log(`[seed-pilot-calendar] mode=${APPLY ? "APPLY" : "DRY-RUN"}`);
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL missing");
  }
  if (APPLY && !process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY missing");
  }

  const { year, month } = nextMonth(new Date());
  const dates = trainingDates(year, month);
  console.log(
    `Scheduling ${dates.length} Tue/Thu practices in ${year}-${pad(month)} at ${pad(PRACTICE_HOUR)}:${pad(PRACTICE_MINUTE)} ${TIME_ZONE}`
  );

  const coaches = await prisma.user.findMany({
    where: { email: { in: [...COACH_EMAILS] } },
    select: {
      id: true,
      email: true,
      name: true,
      coachLevel: true,
      teamAgeGroups: true,
    },
  });
  if (coaches.length !== COACH_EMAILS.length) {
    const found = new Set(coaches.map((c) => c.email));
    const missing = COACH_EMAILS.filter((e) => !found.has(e));
    throw new Error(`Missing pilot coaches: ${missing.join(", ")}. Run seed:pilot-coaches -- --apply first.`);
  }

  let createdSessions = 0;
  let createdEvents = 0;
  let failed = 0;

  for (const coach of coaches) {
    const ageGroup = representativeAge(coach.teamAgeGroups);
    const formations = formationsForAge(ageGroup);
    const numbers = numbersForAge(ageGroup);
    const scope = await resolveClubSessionScope(coach.id);
    if (!scope?.clubId) {
      throw new Error(`${coach.email} has no club scope`);
    }

    console.log(
      `Coach ${coach.email} age=${ageGroup} club=${scope.clubName} model=${scope.gameModelId}`
    );

    const sessionIds: string[] = [];

    for (const { phase, zone } of PHASES) {
      const allowed = await canGenerateSessions(coach.id, ageGroup);
      if (!allowed) {
        throw new Error(`${coach.email} cannot generate ${ageGroup}`);
      }

      const input: SessionPromptInput = {
        gameModelId: scope.gameModelId,
        ageGroup,
        phase,
        zone,
        numbersMin: numbers.min,
        numbersMax: numbers.max,
        goalsAvailable: 2,
        spaceConstraint: ageGroup === "U10" ? "HALF" : "FULL",
        durationMin: 90,
        formationAttacking: formations.att,
        formationDefending: formations.def,
        playerLevel: "INTERMEDIATE",
        coachLevel: coach.coachLevel || "USSF_C",
      };
      if (philosophyHasContent(scope.philosophy)) {
        input.clubPhilosophy = scope.philosophy;
      } else {
        const template = await getGameModelTemplatePhilosophy(scope.gameModelId);
        if (philosophyHasContent(template)) input.clubPhilosophy = template;
      }

      if (!APPLY) {
        console.log(`  WOULD GENERATE ${phase}/${zone} ${formations.att} vs ${formations.def}`);
        continue;
      }

      try {
        const saved = await generateForCoach(coach.id, coach.email || "", input);
        sessionIds.push(saved.id);
        createdSessions += 1;
        console.log(
          `  CREATED ${saved.refCode || saved.id} "${saved.title}" clubId=${saved.clubId} vault=${true}`
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`  FAILED ${phase}: ${message}`);
        try {
          await sleep(4000);
          const saved = await generateForCoach(coach.id, coach.email || "", input, 2);
          sessionIds.push(saved.id);
          createdSessions += 1;
          console.log(
            `  RETRY OK ${saved.refCode || saved.id} "${saved.title}" clubId=${saved.clubId}`
          );
        } catch (retryErr: unknown) {
          failed += 1;
          console.error(
            `  RETRY FAILED ${phase}:`,
            retryErr instanceof Error ? retryErr.message : retryErr
          );
        }
      }

      await sleep(1500);
    }

    if (!APPLY) {
      for (const date of dates) {
        console.log(`  WOULD SCHEDULE ${date.toISOString()} (${weekdayShort(date)})`);
      }
      continue;
    }

    if (sessionIds.length === 0) {
      console.error(`  No sessions for ${coach.email}; skipping calendar`);
      continue;
    }

    for (let i = 0; i < dates.length; i++) {
      const sessionId = sessionIds[i % sessionIds.length];
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { id: true, refCode: true, title: true, durationMin: true },
      });
      if (!session) continue;

      const event = await prisma.calendarEvent.create({
        data: {
          userId: coach.id,
          sessionId: session.id,
          sessionRefCode: session.refCode,
          scheduledDate: dates[i],
          durationMin: session.durationMin || 90,
          location: "Rocklin FC",
          teamName: `${ageGroup} ${coach.email?.split(".")[0]?.toUpperCase()}`,
          notes: "Pilot seed — next-month calendar fill",
          originalCoachId: coach.id,
        },
        select: { id: true, scheduledDate: true },
      });
      createdEvents += 1;
      console.log(
        `  EVENT ${weekdayShort(event.scheduledDate)} ${event.scheduledDate.toISOString()} -> ${session.refCode || session.id}`
      );
    }
  }

  console.log("---");
  console.log(
    `Done. sessions=${createdSessions} events=${createdEvents} failed=${failed} month=${year}-${pad(month)}`
  );
  if (!APPLY) {
    console.log("Re-run with --apply to generate sessions and write calendar events.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
