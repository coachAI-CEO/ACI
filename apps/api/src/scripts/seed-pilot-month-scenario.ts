/**
 * Fill Coach Center for the three Rocklin pilot coaches with one month of
 * training, weekend games, team-chat, and pre/post-game reports.
 *
 * Usage (from apps/api):
 *   pnpm seed:pilot-month
 *   pnpm seed:pilot-month -- --apply
 *   pnpm seed:pilot-month -- --apply --month=2026-08
 *
 * Dry-run (default): prints planned writes. --apply is idempotent: tagged
 * scenario rows are replaced. Existing Sept training events are linked to
 * the coach's primary team so they show in Coach Center.
 */
import "../config/load-env";
import { prisma } from "../prisma";
import { buildDefaultCurriculumWeeks } from "../services/coach-center-curriculum";
import type { MatchRecap } from "../services/match-recap";
import { emptyStats, showcaseRecap } from "../services/match-recap";

const APPLY = process.argv.includes("--apply");
const TAG = "[pilot-month]";
const TIME_ZONE = "America/Los_Angeles";
const MONTH_ARG = process.argv.find((a) => a.startsWith("--month="))?.slice("--month=".length);
const NOW = new Date("2026-08-19T20:00:00-07:00");

const COACHES = [
  {
    email: "7v7.coach@rocklinfc.org",
    teamName: "2017 Girls White",
    ageGroup: "U10",
    formation: "2-3-1",
    practiceHour: 17,
    kickoff: "10:00",
    venue: "Johnson-Springview Park — Field 3",
  },
  {
    email: "9v9.coach@rocklinfc.org",
    teamName: "2015 Girls Navy",
    ageGroup: "U12",
    formation: "3-2-3",
    practiceHour: 17,
    kickoff: "11:30",
    venue: "Whitney High School — Stadium",
  },
  {
    email: "11v11.coach@rocklinfc.org",
    teamName: "07/08 Boys Navy",
    ageGroup: "U18",
    formation: "4-3-3",
    practiceHour: 18,
    kickoff: "13:00",
    venue: "Maidu Regional Park — Field 1",
  },
  {
    email: "doc@rocklinfc.org",
    teamName: "07/08 Girls NPL",
    ageGroup: "U18",
    formation: "4-3-3",
    practiceHour: 18,
    kickoff: "12:00",
    venue: "Whitney High School — Stadium",
  },
] as const;

const OPPONENTS = [
  { name: "Davis Legacy", loc: "Davis, CA" },
  { name: "Folsom Lake Surf", loc: "Folsom, CA" },
  { name: "Placer United", loc: "Roseville, CA" },
  { name: "Sacramento United", loc: "Sacramento, CA" },
  { name: "Elk Grove Soccer", loc: "Elk Grove, CA" },
] as const;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function parseMonth(raw: string | undefined): { year: number; month: number } {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [year, month] = raw.split("-").map(Number);
    return { year, month };
  }
  return { year: 2026, month: 8 };
}

function pacificOffset(month: number): string {
  return month >= 3 && month <= 11 ? "-07:00" : "-08:00";
}

function atPacific(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(
    `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00${pacificOffset(month)}`
  );
}

function weekdayShort(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: TIME_ZONE }).format(date);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthDates(year: number, month: number): { trainingDays: number[]; saturdays: number[] } {
  const trainingDays: number[] = [];
  const saturdays: number[] = [];
  const last = daysInMonth(year, month);
  for (let day = 1; day <= last; day++) {
    const probe = atPacific(year, month, day, 12, 0);
    const weekday = weekdayShort(probe);
    if (weekday === "Tue" || weekday === "Thu") trainingDays.push(day);
    if (weekday === "Sat") saturdays.push(day);
  }
  return { trainingDays, saturdays };
}

function isPast(date: Date): boolean {
  return date.getTime() < NOW.getTime();
}

function recapFor(
  opponent: string,
  location: string,
  week: number,
  teamLabel: string,
  result: { us: number; them: number }
): MatchRecap {
  const won = result.us > result.them;
  const drew = result.us === result.them;
  const headline = won ? "Identity showed up" : drew ? "A hard-earned point" : "Lessons we can use";
  const base = showcaseRecap({ opponent });
  const swing = week * 2;
  return {
    ...base,
    type: "MATCH_RECAP",
    usScore: result.us,
    themScore: result.them,
    caption: `${teamLabel} · Week ${week}`,
    headline,
    summary: won
      ? `We stayed in our shape, played forward when the picture was clean, and ${teamLabel} earned a ${result.us}–${result.them} result against ${opponent}. The scoreboard helped. The habits matter more.`
      : drew
        ? `A ${result.us}–${result.them} draw with ${opponent}. We were organized without the ball and still have work to do in the final third. This is tape we can teach from.`
        : `We dropped a ${result.us}–${result.them} result to ${opponent}. Distances stretched in the second half. We reset the standard on Tuesday — compact, connected, and first-forward when we win it.`,
    location,
    opponentLabel: opponent,
    pillars: [
      { title: "Compact distances", body: "When we stayed connected, they could not play through the middle." },
      { title: "First-forward restart", body: "The best moments came when the first pass after a regain went forward." },
      { title: "Rest defense", body: "We cannot empty the back line to chase the game." },
      { title: "Sideline standard", body: "Families kept the environment. That is part of who we are." },
    ],
    stats: {
      ...emptyStats(),
      shots: { us: 7 + week, them: 6 + (drew ? 1 : won ? 0 : 3) },
      attempts: { us: 11 + week, them: 10 + week },
      corners: { us: 3 + (week % 2), them: 4 },
      freeKicks: { us: 8, them: 7 },
      throwIns: { us: 16 + swing, them: 15 },
      fouls: { us: 8, them: 9 },
      penalties: { us: 0, them: week === 3 ? 1 : 0 },
      passesCompleted: { us: 180 + week * 20, them: 190 + week * 15 },
      possessionPct: { us: won ? 52 : 46, them: won ? 48 : 54 },
      possessionMinutes: { us: won ? 42 : 36, them: won ? 38 : 44 },
      possessionWon: { us: 38 + week, them: 40 },
    },
    takeaways: [
      { title: won ? "We set the tempo" : "We stayed in the fight", body: "The group competed for each other for 70+ minutes." },
      { title: "Final-third decisions", body: "Shoot, combine, or recycle — we will coach the picture, not the panic." },
      { title: "Set pieces", body: "First clearance and rest-defense on the second ball remain a weekly focus." },
      { title: "Next Tuesday", body: "Same theme as the game model. No new ideas — just sharper habits." },
    ],
    nextUp: ["Tuesday training", "Thursday sharpening", `Next: ${OPPONENTS[week % OPPONENTS.length].name}`],
    proudOf: won ? "Proud of the togetherness." : "Proud of the effort when it got ugly.",
    keepBuilding: "Let's keep building the Rocklin way.",
    meaning: base.meaning,
    thankYou: "Thank you families for the sideline standard this weekend.",
    mottos: ["Play forward when it's on", "Stay compact", "Win the next action", "One club. One picture."],
  };
}

function chatPair(opts: {
  teamName: string;
  opponent: string;
  kickoff: string;
  venue: string;
  theme: string;
  past: boolean;
  result?: { us: number; them: number };
}): { user: string; assistant: string }[] {
  const { teamName, opponent, kickoff, venue, theme, past, result } = opts;
  const prep = {
    user: `${TAG} ${teamName} plays ${opponent} this weekend (${kickoff} at ${venue}). Curriculum this week is "${theme}". How should I shape Tuesday/Thursday and the pre-game talk?`,
    assistant: `Keep it simple for ${teamName}.\n\nTuesday: live the weekly theme — ${theme}. One picture, two coaching points, then play. Thursday: shorten it. Same theme, match tempo, set-piece walkthrough (mark, screen, first clearance).\n\nPre-game: ${opponent} will try to play through the middle if we stretch. Cue the nearest player to delay, the second to cover the lane, and the first pass after a regain to go forward if it's on. Kickoff ${kickoff} at ${venue}. No new ideas on Saturday.`,
  };
  if (!past || !result) return [prep];
  const recap = {
    user: `${TAG} Full time vs ${opponent}: ${result.us}–${result.them}. What should I tell the group, and what do we train next week?`,
    assistant: `${result.us > result.them ? "Take the result. Don't over-celebrate the scoreboard." : result.us === result.them ? "A point is a point. The tape will be more useful than the score." : "We dropped it. Reset the standard — don't hide from the second-half distances."}\n\nPlayer message: we compete for each other, we stay compact, we play forward when the picture is clean.\n\nNext week: keep "${theme}" in the warm-up, then progress the same moment one step. Tuesday is correction, not a new curriculum block. I'll have the recap sheet ready for families.`,
  };
  return [prep, recap];
}

async function sessionsFor(coachId: string, ageGroup: string, clubId: string) {
  const own = await prisma.session.findMany({
    where: { generatedBy: coachId, savedToVault: true },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, title: true, refCode: true, durationMin: true, ageGroup: true },
  });
  if (own.length > 0) return own;
  const byAge = await prisma.session.findMany({
    where: { savedToVault: true, clubId, ageGroup },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, title: true, refCode: true, durationMin: true, ageGroup: true },
  });
  if (byAge.length > 0) return byAge;
  return prisma.session.findMany({
    where: { savedToVault: true, clubId },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, title: true, refCode: true, durationMin: true, ageGroup: true },
  });
}

const RESULTS: Array<{ us: number; them: number }> = [
  { us: 2, them: 1 },
  { us: 1, them: 1 },
  { us: 0, them: 2 },
  { us: 3, them: 1 },
  { us: 2, them: 2 },
];

async function main() {
  const { year, month } = parseMonth(MONTH_ARG);
  const { trainingDays, saturdays } = monthDates(year, month);
  console.log(`[seed-pilot-month] mode=${APPLY ? "APPLY" : "DRY-RUN"} month=${year}-${pad(month)}`);
  console.log(`  trainings ${trainingDays.length}  weekend games ${saturdays.length}`);

  const weeks = buildDefaultCurriculumWeeks({ playerLevel: "INTERMEDIATE", teamName: "Navy" });

  for (const spec of COACHES) {
    const coach = await prisma.user.findUnique({
      where: { email: spec.email },
      select: { id: true, email: true, name: true },
    });
    if (!coach) throw new Error(`Missing ${spec.email}. Run seed:pilot-coaches -- --apply first.`);

    const team = await prisma.team.findFirst({
      where: { name: spec.teamName, coaches: { some: { userId: coach.id } } },
      select: { id: true, name: true, ageGroup: true, clubId: true },
    });
    if (!team) throw new Error(`${spec.email} has no team named "${spec.teamName}"`);

    const sessions = await sessionsFor(coach.id, spec.ageGroup, team.clubId || "");
    if (sessions.length === 0) throw new Error(`No vault sessions available for ${spec.email}`);

    console.log(`\n== ${coach.email} / ${team.name} (${team.ageGroup}) sessions=${sessions.length}`);

    const plannedTrainings = trainingDays.map((day, i) => {
      const date = atPacific(year, month, day, spec.practiceHour, 30);
      const session = sessions[i % sessions.length];
      return { date, session, past: isPast(date) };
    });
    const plannedGames = saturdays.map((day, i) => {
      const [hh, mm] = spec.kickoff.split(":").map(Number);
      const date = atPacific(year, month, day, hh, mm);
      const opp = OPPONENTS[i % OPPONENTS.length];
      const week = i + 1;
      const past = isPast(date);
      const result = RESULTS[i % RESULTS.length];
      const theme = weeks[(week - 1) % weeks.length]?.theme || "Team identity";
      return { date, opp, week, past, result, theme };
    });

    for (const row of plannedTrainings) {
      console.log(
        `  TRAIN ${weekdayShort(row.date)} ${row.date.toISOString()} -> ${row.session.refCode || row.session.id} ${row.past ? "done" : "upcoming"}`
      );
    }
    for (const g of plannedGames) {
      console.log(
        `  GAME  Sat ${g.date.toISOString()} vs ${g.opp.name} ${g.past ? `recap ${g.result.us}-${g.result.them}` : "pre-game"}  theme="${g.theme}"`
      );
      for (const pair of chatPair({
        teamName: team.name,
        opponent: g.opp.name,
        kickoff: spec.kickoff,
        venue: spec.venue,
        theme: g.theme,
        past: g.past,
        result: g.result,
      })) {
        console.log(`  CHAT  coach: ${pair.user.slice(0, 88)}…`);
      }
    }

    if (!APPLY) continue;

    await prisma.calendarEvent.deleteMany({
      where: { userId: coach.id, notes: { contains: TAG } },
    });
    await prisma.gameDayDocument.deleteMany({
      where: { teamId: team.id, competition: { contains: TAG } },
    });
    await prisma.coachCenterMessage.deleteMany({
      where: { teamId: team.id, userId: coach.id },
    });

    await prisma.calendarEvent.updateMany({
      where: {
        userId: coach.id,
        teamId: null,
        notes: { contains: "Pilot seed — next-month calendar fill" },
      },
      data: { teamId: team.id, teamName: team.name },
    });

    for (const row of plannedTrainings) {
      await prisma.calendarEvent.create({
        data: {
          userId: coach.id,
          sessionId: row.session.id,
          sessionRefCode: row.session.refCode,
          scheduledDate: row.date,
          durationMin: row.session.durationMin || 90,
          location: spec.venue,
          teamName: team.name,
          teamId: team.id,
          notes: `${TAG} ${weekdayShort(row.date)} training · ${row.session.title}`,
          completed: row.past,
          originalCoachId: coach.id,
        },
      });
    }

    for (const g of plannedGames) {
      const session = sessions[g.week % sessions.length];
      await prisma.calendarEvent.create({
        data: {
          userId: coach.id,
          sessionId: session.id,
          sessionRefCode: session.refCode,
          scheduledDate: g.date,
          durationMin: 90,
          location: spec.venue,
          teamName: team.name,
          teamId: team.id,
          notes: `${TAG} League game vs ${g.opp.name}`,
          completed: g.past,
          originalCoachId: coach.id,
        },
      });

      const recap = g.past
        ? recapFor(g.opp.name, g.opp.loc, g.week, team.name, g.result)
        : undefined;
      await prisma.gameDayDocument.create({
        data: {
          teamId: team.id,
          userId: coach.id,
          matchDate: g.date,
          opponent: g.opp.name,
          venue: spec.venue,
          competition: `NorCal Premier ${TAG}`,
          kickoffTime: spec.kickoff,
          formation: spec.formation,
          keyFocus: `${g.theme}. Play our Rocklin model: compact distances, first-forward restart.`,
          attackingNotes:
            "Play out with a body-open first touch. If the first line is set, attract then find the spare midfielder. Final third: shoot or cutback — no hopeful crosses.",
          defendingNotes:
            "Nearest player delays. Second covers the lane. Rest of the unit stays compact and protects the centre. On loss: counterpress 3–5 seconds or recover together.",
          setPieces:
            "Defending: mark, screen, first clearance, rest-defense for the second ball. Attacking: near-post screen, penalty-spot runner, far-post attack.",
          lineupJson: recap ? (recap as object) : undefined,
        },
      });

      const pairs = chatPair({
        teamName: team.name,
        opponent: g.opp.name,
        kickoff: spec.kickoff,
        venue: spec.venue,
        theme: g.theme,
        past: g.past,
        result: g.result,
      });
      const friday = new Date(g.date);
      friday.setDate(friday.getDate() - 1);
      friday.setHours(g.date.getHours() - 4, 15, 0, 0);
      const sunday = new Date(g.date);
      sunday.setDate(sunday.getDate() + 1);
      sunday.setHours(g.date.getHours() + 3, 10, 0, 0);

      const stamps = [friday, sunday];
      for (let i = 0; i < pairs.length; i++) {
        const createdAt = stamps[i] || g.date;
        await prisma.coachCenterMessage.create({
          data: {
            teamId: team.id,
            userId: coach.id,
            role: "user",
            content: pairs[i].user,
            createdAt,
          },
        });
        await prisma.coachCenterMessage.create({
          data: {
            teamId: team.id,
            userId: coach.id,
            role: "assistant",
            content: pairs[i].assistant,
            createdAt: new Date(createdAt.getTime() + 90_000),
          },
        });
      }
    }

    console.log(`  WROTE trainings=${plannedTrainings.length} games=${plannedGames.length} chats=${plannedGames.reduce((n, g) => n + (g.past ? 2 : 1), 0) * 2}`);
  }

  console.log("\n---");
  if (!APPLY) {
    console.log("Re-run with --apply to write calendar, chat, and game-day documents.");
    return;
  }
  console.log("Done. Log in as:");
  for (const spec of COACHES) console.log(`  ${spec.email}  →  Coach Center / ${spec.teamName}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
