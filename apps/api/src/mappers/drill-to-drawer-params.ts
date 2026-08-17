import type { Drill } from "@prisma/client";
import { randomUUID } from "crypto";
import {
  computeContentWindow,
  computeOneSidedAxisWindow,
  computeTokenRadius,
  defaultFormationsForFormat,
  formatOutfieldPerSide,
  isCenterBackRole,
  looksLikeYardAxis,
  practiceSpaceYards,
  remapToWindow,
  resolveFieldFormat,
  shouldLockPracticeArea,
  shouldReframeAxis,
  shouldReframeOneSidedPitch,
  shouldZoomOut,
  yardsToPercent,
  type FieldFormat,
} from "../data/field-dimensions";
import { ensureMinisOppositeFullGoal, ensureOppositeMiniGoals, ensureTwoFullGoalsAndKeepers, limitKeepersToDrawnFullGoals } from "../services/diagram-goals";
import type {
  DrawerAnnotation,
  DrawerArrow,
  DrawerCoach,
  DrawerGoal,
  DrawerParams,
  DrawerPlayer,
  DrawerZone,
} from "../types/drawer";

type DrillLike = Pick<
  Drill,
  "title" | "json" | "drillType" | "durationMin" | "rpeMin" | "rpeMax" | "numbersMin" | "numbersMax"
> & {
  spaceConstraint?: string | null;
  formationUsed?: string | null;
  phase?: string | null;
  zone?: string | null;
};

export function drillToDrawerParams(drill: DrillLike): DrawerParams {
  const json = asRecord(drill.json);
  const diagram = asRecord(json.diagram ?? json.diagramV1);
  const organization = asRecord(json.organization);
  const area = asRecord(organization.area);
  const rawPlayers = Array.isArray(diagram.players)
    ? diagram.players.map((raw: unknown) => ({ ...asRecord(raw) }))
    : [];
  const rawGoals = Array.isArray(diagram.goals)
    ? diagram.goals.map((raw: unknown) => ({ ...asRecord(raw) }))
    : [];
  const goalsAvailable = Number(json.goalsAvailable);
  const fieldFormatValue = resolveDrawerFieldFormat(json.fieldFormat, rawPlayers.length);
  const spaceConstraint = stringOr(
    drill.spaceConstraint ?? json.spaceConstraint ?? asRecord(diagram.pitch).variant,
    ""
  );
  const lockedArea =
    shouldLockPracticeArea({ drillType: drill.drillType ?? undefined, goalsAvailable }) &&
    (fieldFormatValue === "7V7" || fieldFormatValue === "9V9" || fieldFormatValue === "11V11") &&
    spaceConstraint
      ? practiceSpaceYards(fieldFormatValue, spaceConstraint)
      : null;
  const widthYardsValue = lockedArea ? lockedArea.widthYards : numberOr(area.widthYards, 30);
  const lengthYardsValue = lockedArea ? lockedArea.lengthYards : numberOr(area.lengthYards, 40);
  // Percent-space minis/GKs must be placed AFTER yard→percent, or a 55yd
  // width remap turns y=50 into ~91 and stacks both puggs on one touchline.
  convertYardAxes(rawPlayers, rawGoals, lengthYardsValue, widthYardsValue);
  // Draw-time copy so vault regenerate cannot paint two GKs on one goal
  // even if the stored JSON still has both. Does not mutate the DB row.
  if (goalsAvailable === 2) {
    ensureTwoFullGoalsAndKeepers({ players: rawPlayers, goals: rawGoals });
  } else {
    if (goalsAvailable === 1) ensureMinisOppositeFullGoal({ players: rawPlayers, goals: rawGoals });
    limitKeepersToDrawnFullGoals({ players: rawPlayers, goals: rawGoals });
    if (goalsAvailable === 0) ensureOppositeMiniGoals({ players: rawPlayers, goals: rawGoals });
  }
  diagram.players = rawPlayers;
  diagram.goals = rawGoals;

  let goals: DrawerGoal[] = (Array.isArray(diagram.goals) ? diagram.goals : []).map((raw: unknown) => {
    const g = asRecord(raw);
    return {
      id: stringOr(g.id, randomUUID()),
      x: clampPercent(g.x ?? 50),
      y: clampPercent(g.y ?? 0),
      width: clampPercent(g.width ?? 10),
      type: normalizeGoalType(stringOr(g.type, "")),
    };
  });
  const allowKeepers = goals.some((goal) => goal.type === "full");

  const players: DrawerPlayer[] = rawPlayers.map((raw: unknown) => {
    const p = asRecord(raw);
    return {
      id: stringOr(p.id, randomUUID()),
      number: numberOr(p.number, 1),
      team: normalizeTeam(stringOr(p.team, ""), stringOr(p.role, ""), numberOr(p.number, 0), allowKeepers),
      role: stringOr(p.role, ""),
      x: clampPercent(p.x),
      y: clampPercent(p.y),
      label: typeof p.label === "string" ? p.label : undefined,
    };
  });

  const coach = buildDrawerCoach(diagram);

  const arrows: DrawerArrow[] = (Array.isArray(diagram.arrows) ? diagram.arrows : [])
    .map((raw: unknown, idx: number) => {
      const a = asRecord(raw);
      return {
        id: stringOr(a.id, `arrow-${idx}`),
        from: maybeLinkToCoach(resolvePoint(a.from, rawPlayers, coach), coach),
        to: maybeLinkToCoach(resolvePoint(a.to, rawPlayers, coach), coach),
        type: normalizeArrowType(stringOr(a.type, "")),
        label: typeof a.label === "string" ? a.label : undefined,
      };
    })
    // Drop degenerate arrows: a from/to that couldn't resolve (unmatched
    // playerId, missing x/y) falls back to the same {50,50} default for
    // both ends, producing a zero-length line that's invisible except for
    // a stray arrowhead marker floating at the field's center. Better to
    // drop it than render something misleading.
    .filter((arrow) => Math.hypot(arrow.from.x - arrow.to.x, arrow.from.y - arrow.to.y) >= 2);

  const areaZones: DrawerZone[] = (Array.isArray(diagram.areas) ? diagram.areas : [])
    .map((raw: unknown, idx: number) => {
      const z = asRecord(raw);
      return {
        id: stringOr(z.id, `zone-${idx}`),
        x: clampPercent(z.x ?? 0),
        y: clampPercent(z.y ?? 0),
        width: clampPercent(z.width ?? 0),
        height: clampPercent(z.height ?? 0),
        label: typeof z.label === "string" ? z.label : undefined,
      };
    })
    .filter((zone) => !isFullPitchZone(zone));

  const safeZones: DrawerZone[] = (Array.isArray(diagram.safeZones) ? diagram.safeZones : [])
    .map((raw: unknown, idx: number) => {
      const z = asRecord(raw);
      return {
        id: stringOr(z.id, `safezone-${idx}`),
        x: clampPercent(z.x ?? 0),
        y: clampPercent(z.y ?? 0),
        width: clampPercent(z.width ?? 0),
        height: clampPercent(z.height ?? 0),
        label: typeof z.label === "string" ? z.label : undefined,
        team: typeof z.team === "string" ? z.team : undefined,
        color: typeof z.color === "string" ? z.color : undefined,
      };
    })
    .filter((zone) => !isFullPitchZone(zone));
  const coachingPoints = extractCoachingPoints(json);
  const annotations = buildDrawerAnnotations(diagram, [...areaZones, ...safeZones], coachingPoints);

  const fullGoalCount = goals.filter((goal) => goal.type === "full").length;
  const zoomOut = shouldZoomOut(widthYardsValue, lengthYardsValue, fieldFormatValue);
  const oneSided = !zoomOut && shouldReframeOneSidedPitch(players, fullGoalCount);

  const axisXs = [...players.map((player) => player.x), ...goals.map((goal) => goal.x)];
  const axisYs = [...players.map((player) => player.y), ...goals.map((goal) => goal.y)];
  const xFromYards = looksLikeYardAxis(axisXs, lengthYardsValue);
  const yFromYards = looksLikeYardAxis(axisYs, widthYardsValue);
  if (xFromYards || yFromYards) {
    const remapX = (x: number) => (xFromYards ? yardsToPercent(x, lengthYardsValue) : x);
    const remapY = (y: number) => (yFromYards ? yardsToPercent(y, widthYardsValue) : y);
    applyContentRemap({ players, arrows, coach, areaZones, safeZones, remapX, remapY });
    goals = goals.map((goal) => ({ ...goal, x: remapX(goal.x), y: remapY(goal.y) }));
  }

  // The field rect is always drawn at the same fixed size. Small practice
  // grids (shouldZoomOut) get a full 2D content-window remap. One-goal
  // attacking/defensive thirds are already "full size" so they skipped
  // that path and looked shoved to one sideline -- reframe those on X only.
  // Two-goal full pitches still need a Y remap when tokens sit on one
  // sideline (yard-space leftover or a squeezed 0-100 band).
  if (zoomOut) {
    const contentPoints = [
      ...players.map((p) => ({ x: p.x, y: p.y })),
      ...goals.map((g) => ({ x: g.x, y: g.y })),
      ...areaZones.flatMap((z) => [
        { x: z.x, y: z.y },
        { x: z.x + z.width, y: z.y + z.height },
      ]),
      ...safeZones.flatMap((z) => [
        { x: z.x, y: z.y },
        { x: z.x + z.width, y: z.y + z.height },
      ]),
    ];
    const window = computeContentWindow(contentPoints);
    const remapX = (x: number) => remapToWindow(x, window.minX, window.maxX);
    const remapY = (y: number) => remapToWindow(y, window.minY, window.maxY);
    const withinWindow = (x: number, y: number) =>
      x >= window.minX && x <= window.maxX && y >= window.minY && y <= window.maxY;
    applyContentRemap({
      players,
      arrows,
      coach,
      areaZones,
      safeZones,
      remapX,
      remapY,
    });
    // A goal positioned for a real match pitch (e.g. a full-size goal ~50+
    // yards from a small warmup grid) falls well outside the content
    // window -- drop it rather than remap it into the frame, since drawing
    // it there would misrepresent a goal the drill doesn't actually use as
    // sitting right next to the grid.
    goals = goals
      .filter((goal) => withinWindow(goal.x, goal.y))
      .map((goal) => ({ ...goal, x: remapX(goal.x), y: remapY(goal.y) }));
  } else if (oneSided) {
    const xs = [
      ...players.map((player) => player.x),
      ...goals.map((goal) => goal.x),
    ];
    const ys = [
      ...players.map((player) => player.y),
      ...goals.map((goal) => goal.y),
    ];
    const xWindow = computeOneSidedAxisWindow(xs);
    const remapYAxis = shouldReframeAxis(ys);
    const yWindow = remapYAxis ? computeOneSidedAxisWindow(ys) : { min: 0, max: 100 };
    const remapX = (x: number) => remapToWindow(x, xWindow.min, xWindow.max);
    const remapY = (y: number) =>
      remapYAxis ? remapToWindow(y, yWindow.min, yWindow.max) : y;
    applyContentRemap({
      players,
      arrows,
      coach,
      areaZones,
      safeZones,
      remapX,
      remapY,
    });
    goals = goals.map((goal) => ({ ...goal, x: remapX(goal.x), y: remapY(goal.y) }));
  } else if (shouldReframeAxis(players.map((player) => player.y))) {
    const yWindow = computeOneSidedAxisWindow(players.map((player) => player.y));
    const remapY = (y: number) => remapToWindow(y, yWindow.min, yWindow.max);
    applyContentRemap({
      players,
      arrows,
      coach,
      areaZones,
      safeZones,
      remapX: (x) => x,
      remapY,
    });
    goals = goals.map((goal) => ({ ...goal, y: remapY(goal.y) }));
  }

  if (
    goalsAvailable === 0 &&
    !goals.some((goal) => goal.type === "mini" || goal.type === "gate")
  ) {
    goals.push(
      { id: "MG-LEFT", x: 6, y: 50, width: 5, type: "mini" },
      { id: "MG-RIGHT", x: 94, y: 50, width: 5, type: "mini" }
    );
  }

  const drillType = String(drill.drillType ?? json.drillType ?? "TECHNICAL");
  const defaults = defaultFormationsForFormat(fieldFormatValue);
  const fromText = formationsFromDrillJson(json, organization);
  const formationAttacking = stringOr(
    json.formationAttacking,
    stringOr(
      organization.formationAttacking,
      stringOr(fromText.attacking, stringOr(drill.formationUsed, defaults.attacking))
    )
  );
  const formationDefending = stringOr(
    json.formationDefending,
    stringOr(organization.formationDefending, stringOr(fromText.defending, defaults.defending))
  );
  const laidOutBox = layoutBoxScene({
    players,
    goals,
    drillType,
    areaZones,
    safeZones,
    annotations,
  });
  if (laidOutBox) arrows.length = 0;
  const laidOutOneGoal = layoutOneGoalScene({
    players,
    goals,
    drillType,
    fieldFormat: fieldFormatValue,
    formationAttacking,
    formationDefending,
  });
  if (laidOutOneGoal) arrows.length = 0;
  const laidOutTwoGoal = layoutTwoGoalScene({
    players,
    goals,
    drillType,
    fieldFormat: fieldFormatValue,
    formationAttacking,
    formationDefending,
    phase: stringOr(json.phase, stringOr(drill.phase, "")),
    zone: stringOr(json.zone, stringOr(drill.zone, "")),
  });
  if (laidOutTwoGoal) arrows.length = 0;

  relabelCollapsedUnit(
    players.filter((p) => p.team === "home"),
    formationAttacking,
    false
  );
  relabelCollapsedUnit(
    players.filter((p) => p.team === "away"),
    formationDefending,
    goals.some((goal) => goal.type === "full" && goal.x >= 50)
  );
  lockRoleSides(players);
  centerLoneCenterBacks(players, goals);

  // Detection alone (the spacing scorer) doesn't stop overlapping tokens
  // from shipping -- nothing corrected the model's raw positions. This
  // nudges any players whose tokens would visually collide apart, in real
  // pixel space (not raw percent distance, which is misleading on a
  // non-square field), using the same token-radius math both renderers use
  // to draw. Runs once here so both renderers draw from already-resolved
  // positions instead of needing their own collision logic.
  resolveOverlaps(players, computeTokenRadius(widthYardsValue, lengthYardsValue, fieldFormatValue, players.length));
  lockOneGoalEndlineEquipment(players, goals);

  return {
    title: drill.title || stringOr(json.title, "Drill"),
    drillType,
    format: deriveFormat(json, drill),
    phase: stringOr(json.phase, ""),
    zone: stringOr(json.zone, ""),
    gameModelId: stringOr(json.gameModelId, ""),
    fieldFormat: fieldFormatValue,
    formationAttacking,
    formationDefending,
    durationMin: numberOr(drill.durationMin, numberOr(json.durationMin, numberOr(organization.durationMin, 15))),
    rpeMin: numberOr(drill.rpeMin, numberOr(json.rpeMin, 5)),
    rpeMax: numberOr(drill.rpeMax, numberOr(json.rpeMax, 7)),
    widthYards: widthYardsValue,
    lengthYards: lengthYardsValue,
    players,
    goals,
    arrows,
    zones: [...areaZones, ...safeZones],
    annotations,
    coachingPoints,
    primaryCoachingPicture: stringOr(json.primaryCoachingPicture ?? json.coachingPicture ?? json.keyDetail, ""),
    coach,
    hideMatchPitchMarkings: oneSided,
  };
}

function applyContentRemap(args: {
  players: DrawerPlayer[];
  arrows: DrawerArrow[];
  coach: DrawerCoach | null;
  areaZones: DrawerZone[];
  safeZones: DrawerZone[];
  remapX: (x: number) => number;
  remapY: (y: number) => number;
}) {
  const { players, arrows, coach, areaZones, safeZones, remapX, remapY } = args;
  for (const player of players) {
    player.x = remapX(player.x);
    player.y = remapY(player.y);
  }
  for (const zone of [...areaZones, ...safeZones]) {
    const x2 = remapX(zone.x + zone.width);
    const y2 = remapY(zone.y + zone.height);
    zone.x = remapX(zone.x);
    zone.y = remapY(zone.y);
    zone.width = Math.max(0, x2 - zone.x);
    zone.height = Math.max(0, y2 - zone.y);
  }
  for (const arrow of arrows) {
    if (!arrow.from.isCoach) {
      arrow.from.x = remapX(arrow.from.x);
      arrow.from.y = remapY(arrow.from.y);
    }
    if (!arrow.to.isCoach) {
      arrow.to.x = remapX(arrow.to.x);
      arrow.to.y = remapY(arrow.to.y);
    }
  }
  if (coach) {
    coach.x = remapX(coach.x);
    coach.y = remapY(coach.y);
  }
}

function isFullPitchZone(zone: { width: number; height: number }): boolean {
  return zone.width >= 65 && zone.height >= 45;
}

function buildDrawerCoach(diagram: Record<string, unknown>): DrawerCoach | null {
  const raw = asRecord(diagram.coach);
  if (typeof raw.x !== "number" || typeof raw.y !== "number") return null;
  return {
    x: clampPercent(raw.x),
    y: clampPercent(raw.y),
    label: stringOr(raw.label, "Coach"),
  };
}

// How close (in raw 0-100 percent space) an arrow endpoint's declared
// position has to be to the coach's declared position to count as the same
// point. The isCoach schema field only gets used by the model about half
// the time even when setup text explicitly says the coach starts the
// drill with the ball (an optional/conditional instruction, same
// reliability problem as everything else this session) -- this catches
// the other half deterministically, since the model still places the
// arrow's endpoint AT the coach's raw coordinate even when it doesn't
// flag it explicitly.
const COACH_LINK_THRESHOLD_PERCENT = 8;

function maybeLinkToCoach(
  point: { x: number; y: number; isCoach?: boolean },
  coach: DrawerCoach | null
): { x: number; y: number; isCoach?: boolean } {
  if (!coach || point.isCoach) return point;
  const dist = Math.hypot(point.x - coach.x, point.y - coach.y);
  return dist <= COACH_LINK_THRESHOLD_PERCENT ? { ...point, isCoach: true } : point;
}

function resolvePoint(
  refRaw: unknown,
  players: unknown[],
  coach: DrawerCoach | null
): { x: number; y: number; isCoach?: boolean } {
  const ref = asRecord(refRaw);
  if (ref.isCoach === true && coach) {
    // Raw coach coordinates are a placeholder here -- the mapper has no
    // field geometry to compute where the coach marker actually renders
    // (it gets projected outside the field boundary, see resolveCoachPoint
    // in the renderers). isCoach:true tells the renderer to substitute the
    // real projected point instead of drawing at this raw position.
    return { x: coach.x, y: coach.y, isCoach: true };
  }
  const playerId = typeof ref.playerId === "string" ? ref.playerId : null;
  if (playerId) {
    const player = players.map(asRecord).find((p) => p.id === playerId);
    if (player) return { x: clampPercent(player.x), y: clampPercent(player.y) };
  }
  return { x: clampPercent(ref.x ?? 50), y: clampPercent(ref.y ?? 50) };
}

function normalizeTeam(
  team: string,
  role: string,
  number: number,
  allowKeepers: boolean
): DrawerPlayer["team"] {
  const t = team.toLowerCase();
  const r = role.toLowerCase();
  // GK role must win regardless of team side -- otherwise a player with
  // team="DEF"/"ATT" and role="GK" gets short-circuited into "away"/"home"
  // before this check ever runs, and the keeper renders as a regular
  // outfield player (wrong color/opacity, no GK label downstream).
  // Mini/gate-only layouts never get that treatment: puggs are not
  // GK-defended, so leftover role=GK must render as an outfield token.
  if (
    allowKeepers &&
    (t === "gk" || t === "goalkeeper" || r === "gk" || r.includes("goalkeeper"))
  ) {
    return "gk";
  }
  if (allowKeepers && number === 1 && (r === "gk" || t === "gk")) return "gk";
  if (t === "away" || t === "def" || t === "b") return "away";
  if (t === "neutral" || t === "neut" || t === "n") return "neutral";
  return "home";
}

function normalizeGoalType(type: string): DrawerGoal["type"] {
  const t = type.toLowerCase();
  if (t === "mini" || t === "small") return "mini";
  if (t === "gate") return "gate";
  return "full";
}

function normalizeArrowType(type: string): DrawerArrow["type"] {
  const t = type.toLowerCase();
  if (t === "pass") return "pass";
  if (t === "press") return "press";
  if (t === "run") return "run";
  if (t === "counter") return "counter";
  if (t === "delivery") return "delivery";
  if (t === "finish") return "finish";
  return "movement";
}

function extractCoachingPoints(json: Record<string, unknown>): string[] {
  const raw = json.coachingPoints ?? json.keyCoachingPoints ?? [];
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 3)
    .map((point) => {
      if (typeof point === "string") return point;
      const obj = asRecord(point);
      return stringOr(obj.text ?? obj.point ?? obj.label, "");
    })
    .map((point) => point.trim())
    .filter(Boolean);
}

function buildDrawerAnnotations(
  diagram: Record<string, unknown>,
  zones: DrawerZone[],
  coachingPoints: string[]
): DrawerAnnotation[] {
  const rawAnnotations = Array.isArray(diagram.annotations) ? diagram.annotations : [];
  const annotations: DrawerAnnotation[] = rawAnnotations
    .flatMap((raw: unknown, idx: number): DrawerAnnotation[] => {
      const annotation = asRecord(raw);
      const text = stringOr(annotation.text ?? annotation.label ?? annotation.title, "");
      if (!text) return [];
      return [{
        id: stringOr(annotation.id, `annotation-${idx}`),
        text: truncateAnnotation(text),
        x: clampPercent(annotation.x ?? 50),
        y: clampPercent(annotation.y ?? 50),
        color: typeof annotation.color === "string" ? annotation.color : undefined,
      }];
    })
    .slice(0, 6);

  if (annotations.length) return annotations;

  const zoneAnnotations = zones
    .filter((zone) => zone.label)
    .slice(0, 2)
    .map((zone, idx) => ({
      id: `zone-annotation-${idx}`,
      text: truncateAnnotation(zone.label ?? ""),
      x: clampPercent(zone.x + zone.width / 2),
      y: clampPercent(zone.y + zone.height / 2),
      color: zone.color,
    }));

  const coachingAnnotations = coachingPoints.slice(0, Math.max(0, 3 - zoneAnnotations.length)).map((point, idx) => ({
    id: `coaching-annotation-${idx}`,
    text: truncateAnnotation(point),
    x: 54 + idx * 14,
    y: 24 + idx * 20,
  }));

  return [...zoneAnnotations, ...coachingAnnotations];
}

function truncateAnnotation(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length > 54 ? `${cleaned.slice(0, 51).trim()}...` : cleaned;
}

function deriveFormat(json: Record<string, unknown>, drill: DrillLike): string {
  if (typeof json.format === "string" && json.format.trim()) return json.format.trim();
  if (typeof json.players === "string" && json.players.trim()) return json.players.trim();
  if (typeof json.numbersOnField === "object" && json.numbersOnField) {
    const nums = asRecord(json.numbersOnField);
    const attackers = numberOr(nums.attackersOnField, 0);
    const defenders = numberOr(nums.defendersOnField, 0);
    const neutrals = numberOr(nums.neutralsOnField, 0);
    if (attackers || defenders) return `${attackers}v${defenders}${neutrals ? `+${neutrals}` : ""}`;
  }
  if (drill.numbersMin && drill.numbersMax) return `${drill.numbersMin}-${drill.numbersMax} players`;
  return "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function numberOr(value: unknown, fallback: number): number {
  const next = typeof value === "number" ? value : Number(value);
  return Number.isFinite(next) ? next : fallback;
}

/** Trust the drill's declared fieldFormat if it's a real value; otherwise
 * fall back to guessing from player count (only relevant for drills stored
 * before fieldFormat existed on the generation input). */
function resolveDrawerFieldFormat(declared: unknown, playerCount: number): FieldFormat {
  if (declared === "7V7" || declared === "9V9" || declared === "11V11") return declared;
  return resolveFieldFormat(playerCount);
}

function convertYardAxes(
  players: Array<Record<string, unknown>>,
  goals: Array<Record<string, unknown>>,
  lengthYards: number,
  widthYards: number
): void {
  const xs = [...players, ...goals].map((item) => numberOr(item.x, 50));
  const ys = [...players, ...goals].map((item) => numberOr(item.y, 50));
  const xFromYards = looksLikeYardAxis(xs, lengthYards);
  const yFromYards = looksLikeYardAxis(ys, widthYards);
  if (!xFromYards && !yFromYards) return;
  for (const item of [...players, ...goals]) {
    if (xFromYards) item.x = yardsToPercent(numberOr(item.x, 50), lengthYards);
    if (yFromYards) item.y = yardsToPercent(numberOr(item.y, 50), widthYards);
  }
}

/** A lone CB (no second CB) sits on the center axis, labeled CB. Skip box/rondo. */
function centerLoneCenterBacks(players: DrawerPlayer[], goals: DrawerGoal[]): void {
  if (!goals.some((goal) => goal.type === "full")) return;
  for (const team of ["home", "away"] as const) {
    const cbs = players.filter((player) => player.team === team && isCenterBackRole(player.role));
    if (cbs.length !== 1) continue;
    cbs[0].y = 50;
    cbs[0].role = "CB";
  }
}

function lockRoleSides(players: DrawerPlayer[]): void {
  for (const player of players) {
    if (player.team !== "home" && player.team !== "away") continue;
    const role = String(player.role || "");
    const match = role.toUpperCase().match(/^([LR])([A-Z].*)$/);
    if (!match) continue;
    if (!Number.isFinite(player.y) || (player.y >= 47 && player.y <= 53)) continue;
    const isLeftRole = match[1] === "L";
    // ATT faces right: left = top (low y). DEF faces left, so left = bottom.
    const wantsTopHalf = player.team === "home" ? isLeftRole : !isLeftRole;
    if (player.y < 50 !== wantsTopHalf) {
      player.role = `${isLeftRole ? "R" : "L"}${match[2]}`;
    }
  }
}

function lockOneGoalEndlineEquipment(players: DrawerPlayer[], goals: DrawerGoal[]): void {
  const full = goals.filter((goal) => goal.type === "full");
  const minis = goals.filter((goal) => goal.type === "mini" || goal.type === "gate");
  if (full.length !== 1 || minis.length < 2) return;
  const fullOnRight = full[0].x >= 50;
  full[0].x = fullOnRight ? 100 : 0;
  full[0].y = 50;
  const miniX = fullOnRight ? 6 : 94;
  [...minis]
    .sort((a, b) => a.y - b.y)
    .slice(0, 2)
    .forEach((goal, i) => {
      goal.x = miniX;
      goal.y = i === 0 ? 38 : 62;
    });
  const gks = players.filter((player) => player.team === "gk" || /^gk$/i.test(player.role));
  if (!gks.length) return;
  const fullGk = [...gks].sort((a, b) => Math.abs(a.x - full[0].x) - Math.abs(b.x - full[0].x))[0];
  fullGk.x = fullOnRight ? 94 : 6;
  fullGk.y = 50;
  const pugGk = gks.find((player) => player !== fullGk);
  if (pugGk) {
    pugGk.x = fullOnRight ? 12 : 88;
    pugGk.y = 50;
  }
}

// Must match deterministic-drawer-svg.ts / gemini-drawer-prompt.ts's field
// rect exactly, or collision resolution here won't match what either
// renderer actually draws. tokenRadius math itself is shared via
// computeTokenRadius() in field-dimensions.ts.
const FIELD_PANEL_PX = { width: 564.16, height: 313.24 };

/**
 * Nudges apart any players whose tokens would visually overlap, working in
 * real pixel space (converting each player's percent position through the
 * actual field pixel dimensions) rather than raw percent distance, which
 * is misleading on a non-square field -- a given percent gap is worth
 * fewer pixels vertically than horizontally here. This trusts the model's
 * output for roughly WHERE players are; it only resolves genuine token
 * collisions; it doesn't redesign the formation.
 */
function placeGrid(group: DrawerPlayer[], x0: number, x1: number, y0: number, y1: number): void {
  if (group.length === 0) return;
  const cols = group.length >= 4 ? 2 : Math.min(2, group.length);
  const rows = Math.ceil(group.length / cols);
  group.forEach((player, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    player.x = cols === 1 ? (x0 + x1) / 2 : x0 + (col / (cols - 1)) * (x1 - x0);
    player.y = rows === 1 ? (y0 + y1) / 2 : y0 + (row / Math.max(1, rows - 1)) * (y1 - y0);
  });
}

function layoutRondo(outer: DrawerPlayer[], inner: DrawerPlayer[]): void {
  outer.forEach((player, i) => {
    const angle = (Math.PI * 2 * i) / Math.max(1, outer.length) - Math.PI / 2;
    player.x = clampPercent(50 + 34 * Math.cos(angle));
    player.y = clampPercent(50 + 36 * Math.sin(angle));
  });
  inner.forEach((player, i) => {
    const angle = (Math.PI * 2 * i) / Math.max(1, inner.length) + Math.PI / Math.max(2, inner.length);
    player.x = clampPercent(50 + 12 * Math.cos(angle));
    player.y = clampPercent(50 + 14 * Math.sin(angle));
  });
}

/**
 * Warmup/technical pictures with no full goal: rondo, or 4v4 / 4v4+neutrals
 * playing both ways to one mini each end. Two puggs never share an endline
 * here — that picture is one-full-goal + minis on the opposite end (Scene B).
 */
function layoutBoxScene(args: {
  players: DrawerPlayer[];
  goals: DrawerGoal[];
  drillType: string;
  areaZones: DrawerZone[];
  safeZones: DrawerZone[];
  annotations: DrawerAnnotation[];
}): boolean {
  const { players, goals, drillType, areaZones, safeZones, annotations } = args;
  if (!/WARMUP|TECHNICAL/i.test(drillType)) return false;
  if (goals.some((goal) => goal.type === "full")) return false;
  const attack = players.filter((p) => p.team === "home");
  const defend = players.filter((p) => p.team === "away");
  const neutrals = players.filter((p) => p.team === "neutral");
  if (attack.length + defend.length < 4) return false;

  const bothWays = neutrals.length > 0 || attack.length === defend.length;
  if (bothWays) {
    replaceWithOppositeMinis(goals);
    placeGrid(attack, 16, 40, 26, 74);
    placeGrid(defend, 60, 84, 26, 74);
    neutrals.forEach((player, i) => {
      player.x = 50;
      player.y = i % 2 === 0 ? 12 : 88;
    });
    stripFinishingLabels(areaZones, safeZones, annotations);
    return true;
  }

  replaceArray(
    goals,
    goals.filter((goal) => goal.type === "full")
  );
  stripFinishingLabels(areaZones, safeZones, annotations);
  const outer = attack.length >= defend.length ? attack : defend;
  const inner = outer === attack ? defend : attack;
  layoutRondo(outer, inner);
  return true;
}

function layoutOneGoalScene(args: {
  players: DrawerPlayer[];
  goals: DrawerGoal[];
  drillType: string;
  fieldFormat: FieldFormat;
  formationAttacking: string;
  formationDefending: string;
}): boolean {
  const { players, goals, drillType, fieldFormat, formationAttacking, formationDefending } = args;
  if (!/TACTICAL|CONDITIONED_GAME|FULL_GAME/i.test(drillType)) return false;
  const full = goals.filter((goal) => goal.type === "full");
  if (full.length !== 1) return false;
  const target = formatOutfieldPerSide(fieldFormat);
  padOutfield(players, "home", target, formationAttacking, 40);
  padOutfield(players, "away", target, formationDefending, 62);
  const fullOnRight = full[0].x >= 50;
  const attack = players.filter((player) => player.team === "home");
  const defend = players.filter((player) => player.team === "away");
  placeFormationLines(attack, formationAttacking, fullOnRight ? [24, 44, 62, 76] : [76, 56, 38, 24], fullOnRight);
  placeFormationLines(defend, formationDefending, fullOnRight ? [72, 56, 44, 32] : [28, 44, 56, 68], !fullOnRight);
  return true;
}

function layoutTwoGoalScene(args: {
  players: DrawerPlayer[];
  goals: DrawerGoal[];
  drillType: string;
  fieldFormat: FieldFormat;
  formationAttacking: string;
  formationDefending: string;
  phase: string;
  zone: string;
}): boolean {
  const { players, goals, drillType, fieldFormat, formationAttacking, formationDefending, phase, zone } = args;
  if (!/TACTICAL|CONDITIONED_GAME|FULL_GAME/i.test(drillType)) return false;
  const full = goals.filter((goal) => goal.type === "full");
  if (full.length !== 2) return false;
  const target = formatOutfieldPerSide(fieldFormat);
  padOutfield(players, "home", target, formationAttacking, 40);
  padOutfield(players, "away", target, formationDefending, 62);
  const defendingOwnThird = /DEFENDING/i.test(phase) && /DEFENSIVE_THIRD/i.test(zone);
  const attack = players.filter((player) => player.team === "home");
  const defend = players.filter((player) => player.team === "away");
  if (defendingOwnThird) {
    placeFormationLines(attack, formationAttacking, [50, 64, 76, 86], true);
    placeFormationLines(defend, formationDefending, [88, 76, 64, 52], false);
  } else {
    placeFormationLines(attack, formationAttacking, [22, 42, 62, 76], true);
    placeFormationLines(defend, formationDefending, [78, 58, 38, 24], false);
  }
  return true;
}

function padOutfield(
  players: DrawerPlayer[],
  team: "home" | "away",
  target: number,
  formation: string,
  seedX: number
): void {
  const labels = labelsFromFormation(formation, target) || [];
  let count = players.filter((player) => player.team === team).length;
  while (count < target) {
    players.push({
      id: `${team}-pad-${count}`,
      number: count + 2,
      team,
      role: labels[count] || "CM",
      x: seedX,
      y: 28 + (count % 4) * 16,
    });
    count += 1;
  }
}

function placeFormationLines(
  group: DrawerPlayer[],
  formation: string,
  lineX: number[],
  attackingRight: boolean
): void {
  if (!group.length) return;
  const match = String(formation || "").match(/(\d+(?:-\d+)+)/);
  const nums = match ? match[1].split("-").map(Number).filter((n) => n > 0) : [];
  const xs = nums.length >= 2 ? lineX.slice(0, nums.length) : lineX.slice(0, 2);
  const counts =
    nums.length === xs.length && nums.reduce((sum, n) => sum + n, 0) === group.length
      ? nums
      : splitAcross(group.length, xs.length);
  const queue = [...group].sort((a, b) => a.y - b.y);
  const dir = attackingRight ? 1 : -1;
  let offset = 0;
  xs.forEach((x, line) => {
    const n = counts[line] || 0;
    const slice = queue.slice(offset, offset + n);
    offset += n;
    const kind: "back" | "mid" | "front" =
      line === 0 ? "back" : line === xs.length - 1 ? "front" : "mid";
    const ys = spreadWidth(n, kind);
    slice.forEach((player, i) => {
      player.x = clampPercent(x + dir * lineStagger(kind, n, i));
      player.y = clampPercent(ys[i]);
    });
    const lineLabels = labelsForLine(kind, n);
    const byTeamLeft = [...slice].sort((a, b) => (attackingRight ? a.y - b.y : b.y - a.y));
    byTeamLeft.forEach((player, i) => {
      player.role = lineLabels[i] || player.role;
    });
  });
}

function spreadWidth(n: number, kind: "back" | "mid" | "front"): number[] {
  if (n <= 1) return [50];
  if (n === 2) return kind === "front" ? [40, 60] : [34, 66];
  if (n === 3) return kind === "front" ? [20, 50, 80] : [28, 50, 72];
  if (n === 4) return [24, 41, 59, 76];
  return Array.from({ length: n }, (_, i) => 22 + (i / Math.max(1, n - 1)) * 56);
}

/** Soccer shape, not a spreadsheet. 4-4-2 midfield stays flat; 4-3-3 mids are a triangle. */
function lineStagger(kind: "back" | "mid" | "front", n: number, i: number): number {
  if (kind === "back") {
    const outer = i === 0 || i === n - 1;
    return outer && n >= 3 ? 4 : 0;
  }
  if (kind === "mid") {
    if (n === 4) return 0;
    if (n === 3) return i === 1 ? -6 : 5;
    return 0;
  }
  if (n === 3) return i === 1 ? -3 : 6;
  return 0;
}

function splitAcross(total: number, lines: number): number[] {
  const n = Math.max(1, lines);
  const base = Math.floor(total / n);
  const extra = total % n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

function replaceWithOppositeMinis(goals: DrawerGoal[]): void {
  replaceArray(goals, [
    ...goals.filter((goal) => goal.type === "full"),
    { id: "MG-LEFT", x: 6, y: 50, width: 5, type: "mini" },
    { id: "MG-RIGHT", x: 94, y: 50, width: 5, type: "mini" },
  ]);
}

function stripFinishingLabels(
  areaZones: DrawerZone[],
  safeZones: DrawerZone[],
  annotations: DrawerAnnotation[]
): void {
  const finishing = /finish|scoring zone|final-?third/i;
  const keepZone = (zone: DrawerZone) => !finishing.test(zone.label || "");
  replaceArray(areaZones, areaZones.filter(keepZone));
  replaceArray(safeZones, safeZones.filter(keepZone));
  replaceArray(
    annotations,
    annotations.filter((annotation) => !finishing.test(annotation.text || ""))
  );
}

function replaceArray<T>(target: T[], next: T[]): void {
  target.splice(0, target.length, ...next);
}

function padRoles(roles: string[], n: number, fill: string): string[] {
  const next = roles.slice(0, n);
  while (next.length < n) next.push(fill);
  return next;
}

function backLabels(n: number): string[] {
  if (n <= 1) return ["CB"];
  if (n === 2) return ["CB", "CB"];
  if (n === 3) return ["LB", "CB", "RB"];
  return padRoles(["LB", "CB", "CB", "RB"], n, "CB");
}

function midLabels(n: number): string[] {
  if (n <= 1) return ["CM"];
  if (n === 2) return ["CM", "CM"];
  if (n === 3) return ["LM", "CM", "RM"];
  return padRoles(["LM", "CM", "CM", "RM"], n, "CM");
}

function frontLabels(n: number): string[] {
  if (n <= 1) return ["ST"];
  if (n === 2) return ["ST", "ST"];
  if (n === 3) return ["LW", "ST", "RW"];
  return padRoles(["LW", "ST", "ST", "RW"], n, "ST");
}

function labelsForLine(kind: "back" | "mid" | "front", n: number): string[] {
  if (kind === "back") return backLabels(n);
  if (kind === "front") return frontLabels(n);
  return midLabels(n);
}

function labelsFromFormation(formation: string, count: number): string[] | null {
  const match = String(formation || "").match(/(\d+(?:-\d+)+)/);
  if (!match) return null;
  const nums = match[1].split("-").map(Number).filter((n) => n > 0);
  if (nums.length < 2) return null;
  const labels = nums.flatMap((n, i) => {
    if (i === 0) return backLabels(n);
    if (i === nums.length - 1) return frontLabels(n);
    return midLabels(n);
  });
  while (labels.length < count) labels.push("CM");
  return labels.slice(0, count);
}

function relabelCollapsedUnit(group: DrawerPlayer[], formation: string, defendingRight: boolean): void {
  if (group.length < 4) return;
  const roles = new Set(group.map((p) => String(p.role || "CB").toUpperCase()));
  if (roles.size !== 1) return;
  const labels = labelsFromFormation(formation, group.length);
  if (!labels) return;
  const sorted = [...group].sort((a, b) => {
    const dx = defendingRight ? b.x - a.x : a.x - b.x;
    return dx !== 0 ? dx : a.y - b.y;
  });
  sorted.forEach((player, i) => {
    player.role = labels[i] || player.role;
  });
}

function resolveOverlaps(players: DrawerPlayer[], tokenRadiusPx: number): void {
  if (players.length < 2) return;
  const minDistPx = tokenRadiusPx * 2.3; // more than diameter, for breathing room
  const toPx = (p: { x: number; y: number }) => ({
    x: (p.x / 100) * FIELD_PANEL_PX.width,
    y: (p.y / 100) * FIELD_PANEL_PX.height,
  });

  // 8 iterations wasn't always enough to fully converge a genuinely dense
  // real-formation cluster (e.g. a "compact high pressing zone" with 8+
  // players) -- more passes cost nothing at generation time and guarantee
  // a cleaner result.
  for (let iter = 0; iter < 24; iter++) {
    let moved = false;
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const a = players[i];
        const b = players[j];
        const pa = toPx(a);
        const pb = toPx(b);
        let dx = pb.x - pa.x;
        let dy = pb.y - pa.y;
        let dist = Math.hypot(dx, dy);
        if (dist >= minDistPx) continue;
        if (dist < 0.01) {
          // Exact/near-exact overlap has no real direction to push along --
          // pick a deterministic one from the pair's indices so re-runs are stable.
          const angle = ((i * 47 + j * 71) % 360) * (Math.PI / 180);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          dist = 1;
        }
        const push = (minDistPx - dist) / 2;
        const ux = (dx / dist) * push;
        const uy = (dy / dist) * push;
        a.x = clampPercent(a.x - (ux / FIELD_PANEL_PX.width) * 100);
        a.y = clampPercent(a.y - (uy / FIELD_PANEL_PX.height) * 100);
        b.x = clampPercent(b.x + (ux / FIELD_PANEL_PX.width) * 100);
        b.y = clampPercent(b.y + (uy / FIELD_PANEL_PX.height) * 100);
        moved = true;
      }
    }
    if (!moved) break;
  }
}

function formationsFromDrillJson(
  json: Record<string, any>,
  organization: Record<string, any>
): { attacking: string; defending: string } {
  const blobs: string[] = [];
  const take = (value: unknown) => {
    if (typeof value === "string" && value.trim()) blobs.push(value);
    else if (Array.isArray(value)) value.forEach(take);
  };
  take(organization.setupSteps);
  take(json.description);
  take(json.overview);
  take(json.objective);
  take(json.constraints);
  const text = blobs.join("\n");
  const vs = text.match(/(\d(?:-\d+){1,3})\s+attacking\s+vs\s+(\d(?:-\d+){1,3})\s+defending/i);
  if (vs) return { attacking: vs[1], defending: vs[2] };
  const labeled = text.match(/(\d(?:-\d+){1,3})\s+for attack[,\s]+(\d(?:-\d+){1,3})\s+for defen/i);
  if (labeled) return { attacking: labeled[1], defending: labeled[2] };
  return { attacking: "", defending: "" };
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clampPercent(value: unknown): number {
  return Math.max(0, Math.min(100, numberOr(value, 0)));
}
