import type { DiagramPlayer, DiagramTeamCode, DiagramV1 } from "@/types/diagram";
import type { PitchFormatId } from "@/lib/pitch-formats";

export type FormationId =
  | "2-3-1"
  | "3-2-1"
  | "3-2-3"
  | "2-3-2-1"
  | "3-3-2"
  | "4-4-2"
  | "4-3-3"
  | "4-2-3-1"
  | "3-5-2"
  | "4-1-4-1"
  | "5-3-2";

/** Slot relative to own goal (0=near own goal, 1≈halfway). x across pitch 0–100. */
type Slot = { number: number; role: string; x: number; depth: number };

const FORMATIONS: Record<FormationId, Slot[]> = {
  "2-3-1": [
    { number: 1, role: "GK", x: 50, depth: 0.08 },
    { number: 2, role: "RB", x: 72, depth: 0.28 },
    { number: 3, role: "LB", x: 28, depth: 0.28 },
    { number: 6, role: "CM", x: 50, depth: 0.42 },
    { number: 7, role: "RM", x: 78, depth: 0.48 },
    { number: 11, role: "LM", x: 22, depth: 0.48 },
    { number: 9, role: "ST", x: 50, depth: 0.68 },
  ],
  "3-2-1": [
    { number: 1, role: "GK", x: 50, depth: 0.08 },
    { number: 4, role: "CB", x: 50, depth: 0.26 },
    { number: 2, role: "RB", x: 78, depth: 0.3 },
    { number: 3, role: "LB", x: 22, depth: 0.3 },
    { number: 6, role: "CM", x: 38, depth: 0.48 },
    { number: 8, role: "CM", x: 62, depth: 0.48 },
    { number: 9, role: "ST", x: 50, depth: 0.68 },
  ],
  "3-2-3": [
    { number: 1, role: "GK", x: 50, depth: 0.07 },
    { number: 4, role: "CB", x: 50, depth: 0.24 },
    { number: 2, role: "RB", x: 78, depth: 0.28 },
    { number: 3, role: "LB", x: 22, depth: 0.28 },
    { number: 6, role: "CM", x: 38, depth: 0.44 },
    { number: 8, role: "CM", x: 62, depth: 0.44 },
    { number: 7, role: "RW", x: 82, depth: 0.62 },
    { number: 9, role: "ST", x: 50, depth: 0.68 },
    { number: 11, role: "LW", x: 18, depth: 0.62 },
  ],
  "2-3-2-1": [
    { number: 1, role: "GK", x: 50, depth: 0.07 },
    { number: 4, role: "CB", x: 62, depth: 0.26 },
    { number: 5, role: "CB", x: 38, depth: 0.26 },
    { number: 6, role: "CDM", x: 50, depth: 0.4 },
    { number: 8, role: "CM", x: 68, depth: 0.46 },
    { number: 10, role: "CM", x: 32, depth: 0.46 },
    { number: 7, role: "RAM", x: 65, depth: 0.6 },
    { number: 11, role: "LAM", x: 35, depth: 0.6 },
    { number: 9, role: "ST", x: 50, depth: 0.7 },
  ],
  "3-3-2": [
    { number: 1, role: "GK", x: 50, depth: 0.07 },
    { number: 4, role: "CB", x: 50, depth: 0.24 },
    { number: 2, role: "RB", x: 78, depth: 0.28 },
    { number: 3, role: "LB", x: 22, depth: 0.28 },
    { number: 6, role: "CDM", x: 50, depth: 0.4 },
    { number: 8, role: "CM", x: 68, depth: 0.48 },
    { number: 10, role: "CM", x: 32, depth: 0.48 },
    { number: 9, role: "ST", x: 60, depth: 0.66 },
    { number: 11, role: "ST", x: 40, depth: 0.66 },
  ],
  "4-4-2": [
    { number: 1, role: "GK", x: 50, depth: 0.06 },
    { number: 2, role: "RB", x: 90, depth: 0.3 },
    { number: 4, role: "CB", x: 66, depth: 0.14 },
    { number: 5, role: "CB", x: 34, depth: 0.14 },
    { number: 3, role: "LB", x: 10, depth: 0.3 },
    { number: 7, role: "RM", x: 82, depth: 0.42 },
    { number: 8, role: "CM", x: 62, depth: 0.4 },
    { number: 6, role: "CM", x: 38, depth: 0.4 },
    { number: 11, role: "LM", x: 18, depth: 0.42 },
    { number: 9, role: "ST", x: 60, depth: 0.62 },
    { number: 10, role: "ST", x: 40, depth: 0.62 },
  ],
  "4-3-3": [
    { number: 1, role: "GK", x: 50, depth: 0.06 },
    { number: 2, role: "RB", x: 90, depth: 0.3 },
    { number: 4, role: "CB", x: 66, depth: 0.14 },
    { number: 5, role: "CB", x: 34, depth: 0.14 },
    { number: 3, role: "LB", x: 10, depth: 0.3 },
    { number: 6, role: "CDM", x: 50, depth: 0.36 },
    { number: 8, role: "CM", x: 32, depth: 0.4 },
    { number: 10, role: "CM", x: 68, depth: 0.4 },
    { number: 7, role: "RW", x: 80, depth: 0.6 },
    { number: 9, role: "ST", x: 50, depth: 0.66 },
    { number: 11, role: "LW", x: 20, depth: 0.6 },
  ],
  "4-2-3-1": [
    { number: 1, role: "GK", x: 50, depth: 0.06 },
    { number: 2, role: "RB", x: 90, depth: 0.3 },
    { number: 4, role: "CB", x: 66, depth: 0.14 },
    { number: 5, role: "CB", x: 34, depth: 0.14 },
    { number: 3, role: "LB", x: 10, depth: 0.3 },
    { number: 6, role: "CDM", x: 38, depth: 0.36 },
    { number: 8, role: "CDM", x: 62, depth: 0.36 },
    { number: 7, role: "RAM", x: 78, depth: 0.52 },
    { number: 10, role: "CAM", x: 50, depth: 0.54 },
    { number: 11, role: "LAM", x: 22, depth: 0.52 },
    { number: 9, role: "ST", x: 50, depth: 0.68 },
  ],
  "3-5-2": [
    { number: 1, role: "GK", x: 50, depth: 0.06 },
    { number: 4, role: "CB", x: 68, depth: 0.22 },
    { number: 5, role: "CB", x: 50, depth: 0.2 },
    { number: 3, role: "CB", x: 32, depth: 0.22 },
    { number: 2, role: "RWB", x: 88, depth: 0.4 },
    { number: 8, role: "CM", x: 65, depth: 0.4 },
    { number: 6, role: "CDM", x: 50, depth: 0.36 },
    { number: 7, role: "CM", x: 35, depth: 0.4 },
    { number: 11, role: "LWB", x: 12, depth: 0.4 },
    { number: 9, role: "ST", x: 58, depth: 0.64 },
    { number: 10, role: "ST", x: 42, depth: 0.64 },
  ],
  "4-1-4-1": [
    { number: 1, role: "GK", x: 50, depth: 0.06 },
    { number: 2, role: "RB", x: 90, depth: 0.3 },
    { number: 4, role: "CB", x: 66, depth: 0.14 },
    { number: 5, role: "CB", x: 34, depth: 0.14 },
    { number: 3, role: "LB", x: 10, depth: 0.3 },
    { number: 6, role: "CDM", x: 50, depth: 0.34 },
    { number: 7, role: "RM", x: 82, depth: 0.48 },
    { number: 10, role: "CM", x: 62, depth: 0.46 },
    { number: 8, role: "CM", x: 38, depth: 0.46 },
    { number: 11, role: "LM", x: 18, depth: 0.48 },
    { number: 9, role: "ST", x: 50, depth: 0.66 },
  ],
  "5-3-2": [
    { number: 1, role: "GK", x: 50, depth: 0.06 },
    { number: 2, role: "RWB", x: 88, depth: 0.28 },
    { number: 4, role: "CB", x: 68, depth: 0.2 },
    { number: 5, role: "CB", x: 50, depth: 0.18 },
    { number: 6, role: "CB", x: 32, depth: 0.2 },
    { number: 3, role: "LWB", x: 12, depth: 0.28 },
    { number: 8, role: "CM", x: 65, depth: 0.42 },
    { number: 10, role: "CM", x: 50, depth: 0.4 },
    { number: 7, role: "CM", x: 35, depth: 0.42 },
    { number: 9, role: "ST", x: 58, depth: 0.64 },
    { number: 11, role: "ST", x: 42, depth: 0.64 },
  ],
};

export const FORMATIONS_BY_FORMAT: Record<
  PitchFormatId,
  { id: FormationId; label: string; hint?: string }[]
> = {
  // Matches session generator (SessionForm FORMATION_BY_AGE)
  "7V7": [
    { id: "2-3-1", label: "2-3-1" },
    { id: "3-2-1", label: "3-2-1" },
  ],
  "9V9": [
    { id: "3-2-3", label: "3-2-3" },
    { id: "2-3-2-1", label: "2-3-2-1" },
    { id: "3-3-2", label: "3-3-2" },
  ],
  "11V11": [
    { id: "4-3-3", label: "4-3-3", hint: "Positional play · false nine · flank triangles · #6 drop" },
    { id: "4-2-3-1", label: "4-2-3-1", hint: "Doble pivot · #10 pocket · inverted wingers" },
    { id: "4-4-2", label: "4-4-2", hint: "Short-team ≤25m · double screen · tuck + overlap" },
    { id: "3-5-2", label: "3-5-2", hint: "Libero · WB overloads · 5-man midfield" },
  ],
};

export const DEFAULT_FORMATIONS: Record<
  PitchFormatId,
  { home: FormationId; away: FormationId }
> = {
  "7V7": { home: "2-3-1", away: "3-2-1" },
  "9V9": { home: "3-2-3", away: "3-3-2" },
  "11V11": { home: "4-3-3", away: "4-2-3-1" },
};

/** @deprecated use FORMATIONS_BY_FORMAT */
export const FORMATION_OPTIONS = FORMATIONS_BY_FORMAT["11V11"];

function clamp(n: number) {
  return Math.max(2, Math.min(98, n));
}

export function formationSize(formation: FormationId): number {
  return FORMATIONS[formation].length;
}

/** Common per-side counts coaches use when zooming / small-sided. */
export function playerCountOptions(format: PitchFormatId): Array<number | "all"> {
  const max =
    format === "7V7" ? 7 : format === "9V9" ? 9 : 11;
  const opts: Array<number | "all"> = ["all"];
  for (const n of [11, 9, 7, 5, 4, 3] as const) {
    if (n < max) opts.push(n);
  }
  return opts;
}

/**
 * depth 0 = near own goal, 1 = high up the pitch (into the opposition half).
 * Span is large enough that mids sit around halfway and attackers clearly past it.
 */
function yFromDepth(side: "home" | "away", depth: number) {
  const fromOwnGoal = 5 + depth * 85;
  return side === "home" ? clamp(100 - fromOwnGoal) : clamp(fromOwnGoal);
}

export type FormationBuildOpts = {
  /** Cap players per side; picks those nearest / inside the visible length band. */
  limit?: number;
  /** Visible diagram-y range (0–100 along goal→goal). */
  visibleY?: { min: number; max: number };
};

/**
 * Build players for one side on a FULL pitch.
 * Home (ATT): own goal at high y → right side when HORIZONTAL (attacks right→left).
 * Away (DEF): own goal at low y → left side when HORIZONTAL (attacks left→right).
 *
 * Formation slots are authored facing “up” the pitch with high x = team's right.
 * On a horizontal board, high diagram-x maps to the top touchline — that is the
 * right flank only when the team faces left. Teams attacking left→right must
 * mirror x so RB/RW stay on their right (bottom of screen).
 */
export function buildFormationPlayers(
  formation: FormationId,
  team: DiagramTeamCode,
  side: "home" | "away",
  opts?: FormationBuildOpts
): DiagramPlayer[] {
  const slots = FORMATIONS[formation];
  const built = slots.map((slot, i) => ({
    id: `${side}-${slot.number}-${i}`,
    number: slot.number,
    team,
    role: slot.role,
    x: clamp(side === "away" ? 100 - slot.x : slot.x),
    y: yFromDepth(side, slot.depth),
    labelStyle: "number-only" as const,
    _i: i,
  }));

  const limit = opts?.limit;
  if (!limit || limit >= built.length) {
    return built.map(({ _i, ...p }) => p);
  }

  const yMin = opts?.visibleY?.min ?? 0;
  const yMax = opts?.visibleY?.max ?? 100;
  const scored = built
    .map((p) => {
      let dist = 0;
      if (p.y < yMin) dist = yMin - p.y;
      else if (p.y > yMax) dist = p.y - yMax;
      return { p, dist };
    })
    .sort((a, b) => a.dist - b.dist || a.p._i - b.p._i)
    .slice(0, limit)
    .map(({ p }) => p)
    .sort((a, b) => a._i - b._i);

  return scored.map(({ _i, ...p }) => p);
}

export function buildDefaultMatchDiagram(
  format: PitchFormatId = "11V11",
  homeFormation?: FormationId,
  awayFormation?: FormationId,
  opts?: FormationBuildOpts
): DiagramV1 {
  const defaults = DEFAULT_FORMATIONS[format];
  const homeId = homeFormation || defaults.home;
  const awayId = awayFormation || defaults.away;
  const home = buildFormationPlayers(homeId, "ATT", "home", opts);
  const away = buildFormationPlayers(awayId, "DEF", "away", opts);
  return {
    pitch: {
      variant: "FULL",
      orientation: "HORIZONTAL",
      format,
      showZones: false,
    },
    players: [...home, ...away],
    balls: [{ x: 50, y: 50 }],
    goals: [
      { id: "goal-left", x: 50, y: 2, type: "BIG", width: 16 },
      { id: "goal-right", x: 50, y: 98, type: "BIG", width: 16 },
    ],
    arrows: [],
    areas: [],
    labels: [],
  };
}

export function applyFormationToTeam(
  diagram: DiagramV1,
  team: DiagramTeamCode,
  formation: FormationId,
  side: "home" | "away",
  opts?: FormationBuildOpts
): DiagramV1 {
  const others = (diagram.players || []).filter((p) => p.team !== team);
  const next = buildFormationPlayers(formation, team, side, opts);
  return {
    ...diagram,
    players: [...others, ...next],
  };
}
