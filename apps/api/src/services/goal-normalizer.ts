export type GoalMode = "NOGOAL" | "LARGE" | "MINI2";

type Team = { color: string; count: number; label: string };
type Diagram = {
  miniGoals?: number;
  teams?: Team[];
  [k: string]: any;
};

type DrillJson = {
  gameModel?: string;
  equipment?: string[];
  goalMode?: GoalMode | null;
  diagram?: Diagram;
  [k: string]: any;
};

type Input = {
  goalsAvailable?: number;
  [k: string]: any;
};

function ensureArray<T>(x: T[] | undefined): T[] {
  return Array.isArray(x) ? x : [];
}

function setTeams(diagram: Diagram, goalMode: GoalMode) {
  const teams = ensureArray(diagram.teams);
  const withoutGK = teams.filter(t => t.label !== "GK" && t.color.toLowerCase() !== "green");

  if (goalMode === "LARGE") {
    // ensure a GK team exists (green, count 1)
    const hasGK = teams.some(t => t.label === "GK" || t.color.toLowerCase() === "green");
    diagram.teams = hasGK ? teams : [...withoutGK, { color: "green", count: 1, label: "GK" }];
  } else {
    // remove GK if present
    diagram.teams = withoutGK;
  }
}

function normalizeEquipment(eq: string[] | undefined, goalMode: GoalMode): string[] {
  const list = ensureArray(eq).slice();

  // remove any existing goal mentions (case-insensitive)
  const rm = (s: string) => !/mini-?goals?|full[- ]?size(d)? goals?|full[- ]?size(d)? goal/i.test(s);
  const cleaned = list.filter(rm);

  if (goalMode === "LARGE") {
    cleaned.push("1 Full-size goal");
  } else if (goalMode === "MINI2") {
    cleaned.push("2 Mini-goals");
  }
  // NOGOAL => no goals re-added
  return cleaned;
}

export function normalizeGoals(drill: { json?: DrillJson }, input: Input) {
  if (!drill || !drill.json) return;

  const j = drill.json;
  const goals = typeof input.goalsAvailable === "number" ? input.goalsAvailable : 0;

  let mode: GoalMode = "NOGOAL";
  if (goals >= 2) mode = "MINI2";
  else if (goals === 1) mode = "LARGE";
  else mode = "NOGOAL";

  j.goalMode = mode;

  // diagram
  j.diagram = j.diagram || {};
  if (mode === "MINI2") j.diagram.miniGoals = 2;
  else j.diagram.miniGoals = 0;

  // GK team presence
  setTeams(j.diagram, mode);

  // equipment normalization
  j.equipment = normalizeEquipment(j.equipment, mode);
}
