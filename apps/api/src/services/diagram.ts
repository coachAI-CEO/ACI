/**
 * Normalize the legacy drill.json.diagram structure into Diagram V1:
 * - Players array with real positional numbers
 * - Basic pitch config
 * - Coach, arrows, etc.
 *
 * Legacy diagram shape (example):
 * {
 *   pitch: "CUSTOM",
 *   fieldSize: { widthYards, lengthYards },
 *   miniGoals: 2,
 *   coach: { x, y, restart },
 *   teams: [{ color, count, label }, ...],
 *   startingPositions: [
 *     { id, x, y, team: "Attack"|"Defend"|"Marker"|"GK", label },
 *     ...
 *   ],
 *   arrows: [...]
 * }
 */

export type DiagramV1 = {
  pitch: {
    variant: "FULL" | "HALF" | "THIRD" | "QUARTER" | "CUSTOM";
    orientation: "HORIZONTAL" | "VERTICAL";
    showZones: boolean;
    zones: {
      leftWide: boolean;
      leftHalfSpace: boolean;
      centralChannel: boolean;
      rightHalfSpace: boolean;
      rightWide: boolean;
    };
  };
  players: Array<{
    id: string;
    number: number;
    team: "ATT" | "DEF" | "NEUTRAL";
    role?: string;
    x: number;
    y: number;
    relativePosition?: "wide-left" | "wide-right" | "half-space-left" | "half-space-right" | "central";
    facingAngle: number;
    labelStyle?: "number-only" | "number-and-role";
  }>;
  coach?: {
    x: number;
    y: number;
    label?: string;
    note?: string;
  };
  balls?: Array<{ x: number; y: number }>;
  cones?: Array<{ x: number; y: number; color?: "red" | "yellow" | "blue" | "white" }>;
  arrows?: Array<{
    from: { playerId?: string; x?: number; y?: number };
    to: { playerId?: string; x?: number; y?: number };
    type: "run" | "pass" | "press" | "cover" | "transition";
    style: "solid" | "dashed" | "dotted";
    weight: "normal" | "bold";
  }>;
  areas?: Array<{
    type:
      | "scoringZone"
      | "buildUpZone"
      | "pressingTrap"
      | "supportZone"
      | "wideChannel"
      | "halfSpace"
      | "custom";
    x: number;
    y: number;
    width: number;
    height: number;
    label?: string;
    opacity?: number;
  }>;
  labels?: Array<{ x: number; y: number; text: string }>;
};

/**
 * Infer a positional number based on legacy label + id + x coordinate.
 * This is heuristic but good enough for automatic diagrams.
 */
function inferPositionalNumber(
  id: string,
  team: string,
  label: string | undefined,
  x: number
): number {
  const l = (label || "").toLowerCase();
  const i = (id || "").toLowerCase();

  if (l.includes("gk") || i.startsWith("g")) return 1;

  if (l.includes("cb")) {
    // left vs right center-back
    return x < 50 ? 4 : 5;
  }

  if (l.includes("dm") || l.includes("pivot") || l.includes("6")) return 6;
  if (l.includes("cm") || l.includes("8")) return 8;
  if (l.includes("cam") || l.includes("10") || l.includes("am")) return 10;

  if (l.includes("wing") || l.includes("wide")) {
    return x < 50 ? 11 : 7;
  }

  if (l.includes("striker") || l.includes("9") || l.includes("st")) return 9;

  // Default: central midfielder-ish
  return 8;
}

/**
 * Infer a short role code from label.
 */
function inferRole(label: string | undefined): string | undefined {
  if (!label) return undefined;
  const l = label.toLowerCase();
  if (l.includes("gk")) return "GK";
  if (l.includes("cb")) return "CB";
  if (l.includes("dm")) return "DM";
  if (l.includes("cm")) return "CM";
  if (l.includes("cam") || l.includes("10")) return "AM";
  if (l.includes("wing") || l.includes("wide")) return "W";
  if (l.includes("striker") || l.includes("9") || l.includes("st")) return "ST";
  return label;
}

/**
 * Infer relative lane based on x coordinate.
 */
function inferRelativePosition(x: number): DiagramV1["players"][number]["relativePosition"] {
  if (x < 20) return "wide-left";
  if (x < 40) return "half-space-left";
  if (x < 60) return "central";
  if (x < 80) return "half-space-right";
  return "wide-right";
}

/**
 * Normalize the legacy diagram structure into Diagram V1.
 */
export function normalizeDiagramLegacyToV1(legacy: any): DiagramV1 | null {
  if (!legacy || typeof legacy !== "object") return null;

  const pitch: DiagramV1["pitch"] = {
    variant: "HALF",
    orientation: "HORIZONTAL",
    showZones: true,
    zones: {
      leftWide: true,
      leftHalfSpace: true,
      centralChannel: true,
      rightHalfSpace: true,
      rightWide: true,
    },
  };

  const players: DiagramV1["players"] = [];

  const startingPositions: any[] = Array.isArray(legacy.startingPositions)
    ? legacy.startingPositions
    : [];

  for (const p of startingPositions) {
    const id = String(p.id || "");
    const teamRaw = String(p.team || "");
    const label = typeof p.label === "string" ? p.label : undefined;
    const x = typeof p.x === "number" ? p.x : 50;
    const y = typeof p.y === "number" ? p.y : 50;

    // Skip pure markers (we will treat them later as labels/areas)
    if (teamRaw.toLowerCase() === "marker") continue;

    const team: "ATT" | "DEF" | "NEUTRAL" =
      teamRaw.toLowerCase() === "attack"
        ? "ATT"
        : teamRaw.toLowerCase() === "defend" || teamRaw.toLowerCase() === "defense" || teamRaw.toLowerCase() === "def"
        ? "DEF"
        : "NEUTRAL";

    const number = inferPositionalNumber(id, teamRaw, label, x);
    const role = inferRole(label);
    const relativePosition = inferRelativePosition(x);

    // Facing: ATTacks toward y=0 (upwards), DEF faces towards attackers (downwards)
    const facingAngle =
      team === "ATT"
        ? 90 // up
        : team === "DEF"
        ? 270 // down
        : 90;

    players.push({
      id,
      number,
      team,
      role,
      x,
      y,
      relativePosition,
      facingAngle,
      labelStyle: "number-and-role",
    });
  }

  // Coach
  let coach: DiagramV1["coach"] | undefined;
  if (legacy.coach && typeof legacy.coach === "object") {
    coach = {
      x: typeof legacy.coach.x === "number" ? legacy.coach.x : 10,
      y: typeof legacy.coach.y === "number" ? legacy.coach.y : 80,
      label: "Coach",
      note: typeof legacy.coach.restart === "string" ? legacy.coach.restart : undefined,
    };
  }

  // Arrows: map to V1 shape as best as we can
  const arrows: DiagramV1["arrows"] = [];
  const legacyArrows: any[] = Array.isArray(legacy.arrows) ? legacy.arrows : [];

  for (const a of legacyArrows) {
    const fromId = typeof a.fromId === "string" ? a.fromId : undefined;
    const toId = typeof a.toId === "string" ? a.toId : undefined;

    // Map legacy types loosely
    let type: "run" | "pass" | "press" | "cover" | "transition" = "run";
    if (a.type === "pass") type = "pass";
    else if (a.type === "dribble") type = "run";
    else if (a.type === "press") type = "press";

    const style: "solid" | "dashed" | "dotted" =
      a.style === "dotted" ? "dotted" : a.style === "dashed" ? "dashed" : "solid";

    const weight: "normal" | "bold" =
      type === "run" && style === "solid" ? "bold" : "normal";

    arrows.push({
      from: fromId ? { playerId: fromId } : {},
      to: toId ? { playerId: toId } : {},
      type,
      style,
      weight,
    });
  }

  const v1: DiagramV1 = {
    pitch,
    players,
    coach,
    balls: [],
    cones: [],
    arrows,
    areas: [],
    labels: [],
  };

  return ensureGoals(v1, legacy);
}

function ensureGoals(diagram: any, source: any): any {
  // If the model already supplied goals explicitly, don't touch them.
  if (diagram.goals && Array.isArray(diagram.goals) && diagram.goals.length > 0) {
    return diagram;
  }

  const goals: any[] = [];

  const pitch = diagram.pitch || {};
  const orientation = pitch.orientation || "HORIZONTAL";

  // Normalized midline
  const centerX = 50;

  // For HALF + HORIZONTAL, treat y=10 as one end line and y=90 as the opposite.
  const bigGoalY = orientation === "HORIZONTAL" ? 10 : 10;
  const miniGoalsY = orientation === "HORIZONTAL" ? 90 : 90;

  // Heuristic: if there is a GK or number 1, assume there is a big goal there.
  const hasGK =
    diagram.players?.some(
      (p: any) => p.role === "GK" || p.number === 1
    ) ?? false;

  if (hasGK) {
    goals.push({
      id: "G-BIG",
      type: "BIG",
      width: 12, // renderer can interpret this normalized width
      x: centerX,
      y: bigGoalY,
      facingAngle: 90,
      teamAttacks: "ATT",
    });
  }

  // Mini-goals: driven by drill JSON
  const goalMode: string | undefined = source?.goalMode;
  const goalsAvailable: number =
    ((typeof source?.goalsAvailable === "number"
      ? source.goalsAvailable
      : typeof source?.miniGoals === "number"
      ? source.miniGoals
      : typeof source?.diagram?.miniGoals === "number"
      ? source.diagram.miniGoals
      : 0) || 0);

  const wantsTwoMiniGoals =
    goalMode === "MINI2" || goalsAvailable === 2;

  if (wantsTwoMiniGoals) {
    goals.push(
      {
        id: "MG1",
        type: "MINI",
        width: 6,
        x: 25,
        y: miniGoalsY,
        facingAngle: 270,
        teamAttacks: "DEF",
      },
      {
        id: "MG2",
        type: "MINI",
        width: 6,
        x: 75,
        y: miniGoalsY,
        facingAngle: 270,
        teamAttacks: "DEF",
      }
    );
  }

  if (goals.length === 0) {
    return diagram;
  }

  return {
    ...diagram,
    goals,
  };
}
