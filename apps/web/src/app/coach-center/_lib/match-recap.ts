export const STAT_ROWS = [
  { key: "shots", label: "Shots" },
  { key: "attempts", label: "Attempts" },
  { key: "corners", label: "Corners" },
  { key: "freeKicks", label: "Free Kicks" },
  { key: "throwIns", label: "Throw-ins" },
  { key: "fouls", label: "Fouls" },
  { key: "penalties", label: "Penalties" },
  { key: "passesCompleted", label: "Passes Completed" },
  { key: "possessionPct", label: "Possession %" },
  { key: "possessionMinutes", label: "Possession Minutes" },
  { key: "possessionWon", label: "Possession Won" },
] as const;

export type StatKey = (typeof STAT_ROWS)[number]["key"];

export type RecapPair = { title: string; body: string };
export type RecapStat = { us: number; them: number };

export type MatchRecap = {
  type: "MATCH_RECAP";
  usScore: number;
  themScore: number;
  caption: string;
  headline: string;
  summary: string;
  location: string;
  opponentLabel: string;
  pillars: RecapPair[];
  stats: Record<StatKey, RecapStat>;
  takeaways: RecapPair[];
  nextUp: string[];
  proudOf: string;
  keepBuilding: string;
  meaning: RecapPair[];
  thankYou: string;
  mottos: string[];
};

const EMPTY_STAT: RecapStat = { us: 0, them: 0 };

export function emptyStats(): Record<StatKey, RecapStat> {
  return STAT_ROWS.reduce(
    (acc, row) => {
      acc[row.key] = { ...EMPTY_STAT };
      return acc;
    },
    {} as Record<StatKey, RecapStat>
  );
}

export function showcaseRecap(input?: { opponent?: string }): MatchRecap {
  return {
    type: "MATCH_RECAP",
    usScore: 0,
    themScore: 0,
    caption: "Our First Official Match",
    headline: "A Strong Start",
    summary:
      "We opened with composure, a clean sheet, and the defensive discipline this group has been building toward. The scoreboard said 0-0. The performance said we belong — organized, together, and ready to grow.",
    location: "Davis, CA",
    opponentLabel: input?.opponent || "Opponent",
    pillars: [
      {
        title: "Defensive Discipline",
        body: "We limited their looks and stayed compact when the game stretched.",
      },
      {
        title: "Possession to Our Standard",
        body: "When we had the ball, we played at our tempo — not theirs.",
      },
      {
        title: "Team Togetherness",
        body: "Players competed for each other. That is the standard.",
      },
      {
        title: "Growth Mindset",
        body: "First official match. The journey starts here, not with the scoreboard.",
      },
    ],
    stats: {
      shots: { us: 6, them: 9 },
      attempts: { us: 11, them: 14 },
      corners: { us: 3, them: 5 },
      freeKicks: { us: 8, them: 7 },
      throwIns: { us: 18, them: 16 },
      fouls: { us: 9, them: 11 },
      penalties: { us: 0, them: 0 },
      passesCompleted: { us: 287, them: 341 },
      possessionPct: { us: 43, them: 57 },
      possessionMinutes: { us: 34, them: 46 },
      possessionWon: { us: 42, them: 48 },
    },
    takeaways: [
      { title: "Limited Their Chances", body: "A clean sheet against a showcase opponent." },
      { title: "Controlled Possession", body: "We did not chase the game. We stayed in our shape." },
      { title: "Composed Under Pressure", body: "Moments that could have opened up stayed managed." },
      { title: "Built a Foundation", body: "This is tape we can teach from all season." },
    ],
    nextUp: ["More games", "More growth", "More chances to show who we are"],
    proudOf: "Proud of the effort.",
    keepBuilding: "Let's keep building!",
    meaning: [
      { title: "The numbers", body: "The stats tell a competitive story, not a deficit." },
      { title: "The group", body: "This team is learning how to suffer together." },
      { title: "The standard", body: "Identity showed up even when the scoreboard did not." },
      { title: "The sideline", body: "Families made the environment. That matters." },
    ],
    thankYou: "Thank you families for your support!",
    mottos: [
      "Development over validation",
      "Consistency compounds",
      "Accountability creates confidence",
      "One team. One purpose.",
    ],
  };
}

function asNum(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asStr(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asPair(value: unknown, fallback: RecapPair): RecapPair {
  if (!value || typeof value !== "object") return fallback;
  const row = value as Record<string, unknown>;
  return { title: asStr(row.title, fallback.title), body: asStr(row.body, fallback.body) };
}

function asStat(value: unknown): RecapStat {
  if (Array.isArray(value)) return { us: asNum(value[0]), them: asNum(value[1]) };
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return { us: asNum(row.us), them: asNum(row.them) };
  }
  return { ...EMPTY_STAT };
}

export function parseMatchRecap(raw: unknown): MatchRecap | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const looksLikeRecap =
    row.type === "MATCH_RECAP" ||
    typeof row.headline === "string" ||
    typeof row.usScore === "number" ||
    (row.stats && typeof row.stats === "object");
  if (!looksLikeRecap) return null;

  const base = showcaseRecap({ opponent: asStr(row.opponentLabel) || undefined });
  const statsRaw = row.stats && typeof row.stats === "object" ? (row.stats as Record<string, unknown>) : {};
  const stats = emptyStats();
  for (const item of STAT_ROWS) {
    stats[item.key] = statsRaw[item.key] ? asStat(statsRaw[item.key]) : base.stats[item.key];
  }

  const pillarsIn = Array.isArray(row.pillars) ? row.pillars : base.pillars;
  const takeawaysIn = Array.isArray(row.takeaways) ? row.takeaways : base.takeaways;
  const meaningIn = Array.isArray(row.meaning) ? row.meaning : base.meaning;
  const nextIn = Array.isArray(row.nextUp) ? row.nextUp.map((item) => asStr(item)).filter(Boolean) : base.nextUp;
  const mottosIn = Array.isArray(row.mottos) ? row.mottos.map((item) => asStr(item)).filter(Boolean) : base.mottos;

  return {
    type: "MATCH_RECAP",
    usScore: asNum(row.usScore, base.usScore),
    themScore: asNum(row.themScore, base.themScore),
    caption: asStr(row.caption, base.caption),
    headline: asStr(row.headline, base.headline),
    summary: asStr(row.summary, base.summary),
    location: asStr(row.location, base.location),
    opponentLabel: asStr(row.opponentLabel, base.opponentLabel) || "Opponent",
    pillars: [0, 1, 2, 3].map((i) => asPair(pillarsIn[i], base.pillars[i])),
    stats,
    takeaways: [0, 1, 2, 3].map((i) => asPair(takeawaysIn[i], base.takeaways[i])),
    nextUp: nextIn.length ? nextIn.slice(0, 6) : base.nextUp,
    proudOf: asStr(row.proudOf, base.proudOf),
    keepBuilding: asStr(row.keepBuilding, base.keepBuilding),
    meaning: [0, 1, 2, 3].map((i) => asPair(meaningIn[i], base.meaning[i])),
    thankYou: asStr(row.thankYou, base.thankYou),
    mottos: mottosIn.length ? mottosIn.slice(0, 4) : base.mottos,
  };
}

export function barWidth(us: number, them: number, key: StatKey): { us: number; them: number } {
  if (key === "possessionPct") {
    return { us: Math.max(0, Math.min(100, us)), them: Math.max(0, Math.min(100, them)) };
  }
  const max = Math.max(us, them, 1);
  return { us: (us / max) * 100, them: (them / max) * 100 };
}

export function clubInitials(name: string): string {
  const parts = name
    .replace(/FC|SC|UNITED|CLUB/gi, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name.replace(/[^A-Za-z]/g, "").slice(0, 3) || "FC").toUpperCase();
}

export function formatRecapDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
