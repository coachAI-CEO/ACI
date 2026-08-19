import { randomUUID } from "crypto";
import {
  computeContentWindow,
  computeOneSidedAxisWindow,
  computeTokenRadius,
  defaultFormationsForFormat,
  formatOutfieldPerSide,
  isCenterBackRole,
  isWarmupPicture,
  looksLikeYardAxis,
  parseFormationNums,
  pictureOutfieldCap,
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
import { pickClearestTarget, tokenBlocksLane } from "../services/arrow-routing";
import type {
  DrawerAnnotation,
  DrawerArrow,
  DrawerCoach,
  DrawerGoal,
  DrawerParams,
  DrawerPlayer,
  DrawerZone,
} from "../types/drawer";

type DrillLike = {
  title?: string | null;
  json?: unknown;
  drillType?: string | null;
  durationMin?: number | null;
  rpeMin?: number | null;
  rpeMax?: number | null;
  numbersMin?: number | null;
  numbersMax?: number | null;
  spaceConstraint?: string | null;
  formationUsed?: string | null;
  phase?: string | null;
  zone?: string | null;
  coachLevel?: string | null;
};

export function drillToDrawerParams(drill: DrillLike): DrawerParams {
  const json = asRecord(drill.json);
  const diagram = asRecord(json.diagram ?? json.diagramV1);
  const organization = asRecord(json.organization);
  const area = asRecord(organization.area);
  const drillType = isWarmupPicture(drill.drillType) || isWarmupPicture(String(json.drillType || ""))
    ? "WARMUP"
    : String(drill.drillType ?? json.drillType ?? "TECHNICAL");
  const rawPlayers = Array.isArray(diagram.players)
    ? diagram.players.map((raw: unknown) => ({ ...asRecord(raw) }))
    : [];
  const rawGoals = Array.isArray(diagram.goals)
    ? diagram.goals.map((raw: unknown) => ({ ...asRecord(raw) }))
    : [];
  // Warmup is a box (rondo / 4v4 minis), not the session's two-goal kit.
  // goalsAvailable=2 on the session used to stamp full nets + GKs onto a
  // 4v2 activation and skip layoutBoxScene.
  if (isWarmupPicture(drillType)) {
    replaceArray(
      rawPlayers,
      rawPlayers.filter((p) => !isRawKeeper(p))
    );
    replaceArray(
      rawGoals,
      rawGoals.filter((g) => {
        const t = String(g.type || "").toUpperCase();
        return t === "MINI" || t === "SMALL" || t === "GATE" || t === "PUGG";
      })
    );
  }
  const goalsAvailable = isWarmupPicture(drillType) ? 0 : Number(json.goalsAvailable);
  const fieldFormatValue = resolveDrawerFieldFormat(json.fieldFormat, rawPlayers.length);
  const spaceConstraint = stringOr(
    drill.spaceConstraint ?? json.spaceConstraint ?? asRecord(diagram.pitch).variant,
    ""
  );
  const lockedArea =
    shouldLockPracticeArea({ drillType, goalsAvailable }) &&
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
  // Two-goal match pictures must keep y=50 as the pitch midline. Remapping
  // Y off a scatter cluster is what put both goals (and GKs) below the
  // painted center circle.
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
  } else if (fullGoalCount < 2 && shouldReframeAxis(players.map((player) => player.y))) {
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
  const technicalUnopposed =
    /TECHNICAL/i.test(drillType) &&
    !oppositionSpecified(json, organization, drill.title) &&
    goals.some((goal) => goal.type === "full");
  if (technicalUnopposed) {
    replaceArray(
      players,
      players.filter((player) => player.team !== "away")
    );
    stripMatchLaneZones(areaZones, safeZones, annotations);
  }
  trimToPictureBudget(players, drillType, fieldFormatValue, goals);
  const laidOutBox = layoutBoxScene({
    players,
    goals,
    drillType,
    areaZones,
    safeZones,
    annotations,
    formationAttacking,
    formationDefending,
  });
  if (laidOutBox) {
    arrows.length = 0;
    stripMatchLaneZones(areaZones, safeZones, annotations);
  }
  const laidOutOneGoal = layoutOneGoalScene({
    players,
    goals,
    drillType,
    fieldFormat: fieldFormatValue,
    formationAttacking,
    formationDefending,
  });
  if (laidOutOneGoal) arrows.length = 0;
  const phase = stringOr(json.phase, stringOr(drill.phase, ""));
  const zone = stringOr(json.zone, stringOr(drill.zone, ""));
  const laidOutTwoGoal = layoutTwoGoalScene({
    players,
    goals,
    drillType,
    fieldFormat: fieldFormatValue,
    formationAttacking,
    formationDefending,
    phase,
    zone,
  });
  if (laidOutTwoGoal) arrows.length = 0;

  if (!laidOutBox) {
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
  }
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
  pinEndlineGoals(players, goals);

  const relaid = laidOutBox || laidOutOneGoal || laidOutTwoGoal;
  const coachLevel = resolveCoachLevel(drill.coachLevel ?? json.coachLevel, drillType, goals);
  const opposed = players.some((player) => player.team === "away");
  const density = densityFor(coachLevel, drillType, goals, opposed);
  if (relaid || arrows.length === 0) {
    const topicArrows = layoutTopicArrows({ players, goals, drillType, phase, zone, density });
    if (topicArrows.length) replaceArray(arrows, topicArrows);
  }
  if (density !== "d") {
    const labels = [...areaZones, ...safeZones].map((z) => String(z.label || ""));
    if (!labels.some((label) => /match area/i.test(label))) {
      for (const concept of layoutConceptZones({ players, goals, phase, zone, density })) {
        safeZones.push(concept);
      }
    }
  }

  ensureShirtNumbers(players);

  return {
    title: drill.title || stringOr(json.title, "Drill"),
    drillType,
    format: deriveFormat(json, drill),
    phase,
    zone,
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

function outfieldTarget(format: FieldFormat, formation: string): number {
  const nums = parseFormationNums(formation);
  if (nums) return nums.reduce((sum, n) => sum + n, 0);
  return formatOutfieldPerSide(format);
}

function pinEndlineGoals(players: DrawerPlayer[], goals: DrawerGoal[]): void {
  const endline = (goal: DrawerGoal) => goal.x <= 22 || goal.x >= 78;
  for (const goal of goals) {
    if (goal.type === "full" && endline(goal)) goal.y = 50;
  }
  const pinMinis = (side: DrawerGoal[]) => {
    const sorted = [...side].sort((a, b) => a.y - b.y);
    if (sorted.length === 1) sorted[0].y = 50;
    if (sorted.length >= 2) {
      sorted[0].y = 32;
      sorted[1].y = 68;
    }
  };
  pinMinis(goals.filter((goal) => (goal.type === "mini" || goal.type === "gate") && goal.x <= 22));
  pinMinis(goals.filter((goal) => (goal.type === "mini" || goal.type === "gate") && goal.x >= 78));
  const full = goals.filter((goal) => goal.type === "full" && endline(goal));
  if (full.length !== 2) return;
  const gks = players.filter((player) => player.team === "gk" || /^gk$/i.test(player.role));
  for (const gk of gks) {
    const nearest = [...full].sort((a, b) => Math.abs(a.x - gk.x) - Math.abs(b.x - gk.x))[0];
    if (!nearest) continue;
    gk.y = 50;
    gk.x = nearest.x >= 50 ? 94 : 6;
  }
}

function resolveCoachLevel(raw: unknown, drillType: string, goals: DrawerGoal[]): "USSF_D" | "USSF_C" | "USSF_B_PLUS" {
  const key = String(raw || "").toUpperCase().replace(/\s+/g, "_");
  if (key === "USSF_D" || key === "D") return "USSF_D";
  if (key === "USSF_B_PLUS" || key === "USSF_B" || key === "B+" || key === "B") return "USSF_B_PLUS";
  if (key === "USSF_C" || key === "C") return "USSF_C";
  return isCompactDPicture(drillType, goals) ? "USSF_D" : "USSF_C";
}

function isCompactDPicture(drillType: string, goals: DrawerGoal[]): boolean {
  if (/WARMUP/i.test(drillType)) return true;
  return /TECHNICAL/i.test(drillType) && !goals.some((g) => g.type === "full");
}

type DiagramDensity = "d" | "c" | "bplus";

function densityFor(
  coachLevel: "USSF_D" | "USSF_C" | "USSF_B_PLUS",
  drillType: string,
  goals: DrawerGoal[],
  opposed = true
): DiagramDensity {
  if (isCompactDPicture(drillType, goals) || coachLevel === "USSF_D") return "d";
  if (/TECHNICAL/i.test(drillType) && !opposed) return "d";
  if (coachLevel === "USSF_B_PLUS") return "bplus";
  return "c";
}

/** USSF D: 2–4 arrows. USSF C: 5–7 of one idea + a zone. B+: 7–10 with a second layered idea. */
function layoutTopicArrows(args: {
  players: DrawerPlayer[];
  goals: DrawerGoal[];
  drillType: string;
  phase: string;
  zone: string;
  density: DiagramDensity;
}): DrawerArrow[] {
  const { players, goals, drillType, phase, zone, density } = args;
  const rich = density !== "d";
  const bplus = density === "bplus";
  const att = players.filter((p) => p.team === "home");
  const def = players.filter((p) => p.team === "away");
  const full = goals.filter((g) => g.type === "full");
  const defending = /DEFENDING/i.test(phase) || /DEFENSIVE_THIRD/i.test(zone);
  const transition = /TRANSITION/i.test(phase);
  const finishing = /TECHNICAL/i.test(drillType) && full.length === 1;
  const cap = bplus ? 10 : rich ? 7 : 4;
  const arrows: DrawerArrow[] = [];
  const add = (type: DrawerArrow["type"], from: { x: number; y: number } | undefined, to: { x: number; y: number } | undefined) => {
    if (!from || !to || Math.hypot(from.x - to.x, from.y - to.y) < 8) return;
    if (arrows.length >= cap) return;
    arrows.push({
      id: `d-${arrows.length + 1}`,
      from: { x: from.x, y: from.y },
      to: { x: to.x, y: to.y },
      type,
    });
  };
  const laneHits = (from: { x: number; y: number }, to: { x: number; y: number }) =>
    players.filter(
      (p) =>
        Math.hypot(p.x - from.x, p.y - from.y) > 6 &&
        Math.hypot(p.x - to.x, p.y - to.y) > 6 &&
        tokenBlocksLane(p, from, to, 8)
    ).length;
  const addOpenPass = (
    pairs: Array<[{ x: number; y: number } | undefined, { x: number; y: number } | undefined]>,
    max = 1
  ) => {
    const scored = pairs
      .filter((pair): pair is [{ x: number; y: number }, { x: number; y: number }] => Boolean(pair[0] && pair[1] && pair[0] !== pair[1]))
      .filter(([a, b]) => Math.hypot(a.x - b.x, a.y - b.y) >= 8)
      .map(([a, b]) => ({ a, b, hits: laneHits(a, b), len: Math.hypot(a.x - b.x, a.y - b.y) }))
      .sort((x, y) => x.hits - y.hits || y.len - x.len);
    const seen = new Set<string>();
    for (const s of scored) {
      const key = `${Math.round(s.a.x)},${Math.round(s.a.y)}>${Math.round(s.b.x)},${Math.round(s.b.y)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      add("pass", s.a, s.b);
      if (seen.size >= max) break;
    }
  };

  const pick = (group: DrawerPlayer[], ...res: RegExp[]) => {
    for (const re of res) {
      const hit = group.find((p) => re.test(String(p.role || "").toUpperCase()));
      if (hit) return hit;
    }
    return undefined;
  };
  const ahead = (p: DrawerPlayer, right: boolean, dist = 14) => {
    const veer = p.y < 42 ? -10 : p.y > 58 ? 10 : 0;
    return {
      x: clampPercent(p.x + (right ? dist : -dist)),
      y: clampPercent(p.y + veer),
    };
  };
  const drop = (p: DrawerPlayer, right: boolean, dist = 10) => ({
    x: clampPercent(p.x + (right ? -dist : dist)),
    y: p.y,
  });
  const goalPt = (right: boolean, shooter?: { x: number; y: number }) => {
    const g = full.find((goal) => (right ? goal.x >= 50 : goal.x < 50));
    const mini = goals.find((goal) => (right ? goal.x >= 78 : goal.x <= 22));
    const x = g ? g.x : mini ? mini.x : right ? 94 : 6;
    if (!shooter) return { x, y: 50 };
    const blockers = players.filter((p) => Math.hypot(p.x - shooter.x, p.y - shooter.y) > 6);
    return pickClearestTarget(shooter, [36, 64, 50].map((y) => ({ x, y })), blockers, 8);
  };

  if (att.length >= 3 && def.length >= 1 && att.length !== def.length && full.length === 0 && /WARMUP|TECHNICAL/i.test(drillType)) {
    const ring = [...att].sort((a, b) => a.y - b.y);
    add("pass", ring[0], ring[Math.floor(ring.length / 2)]);
    add("pass", ring[Math.floor(ring.length / 2)], ring[ring.length - 1]);
    return arrows;
  }

  if (defending && def.length >= 3) {
    const presser = pick(def, /^ST$/, /^CM$/, /^RM$/, /^LM$/) || def[0];
    const cover = pick(def, /^CB$/, /^CDM$/);
    const target = pick(att, /^ST$/, /^CM$/, /^CAM$/) || att[0];
    const second = def.find((p) => p !== presser && /^(CM|RM|LM|ST)$/i.test(String(p.role || "")));
    const recover = pick(def, /^LB$/, /^RB$/, /^LWB$/, /^RWB$/);
    const otherRecover = def.find((p) => p !== recover && /^(LB|RB|LWB|RWB)$/i.test(String(p.role || "")));
    add("press", presser, target);
    if (rich && second) add("press", second, pick(att, /^CM$/, /^LM$/, /^RM$/) || target);
    if (cover) add("run", cover, ahead(cover, false, 10));
    if (rich && recover) add("run", recover, ahead(recover, false, 10));
    if (presser && target) add("pass", pick(att, /^CM$/, /^CB$/) || att[0], target);
    if (bplus && cover) add("press", cover, pick(att, /^CM$/, /^ST$/) || target);
    if (bplus && otherRecover) add("run", otherRecover, ahead(otherRecover, false, 10));
    if (bplus) {
      const rest = pick(att, /^CB$/) || pick(att, /^LB$/);
      if (rest) add("run", rest, drop(rest, true, 10));
    }
    return arrows;
  }

  if (transition && def.length >= 2 && att.length >= 2) {
    const winner = pick(def, /^CM$/, /^ST$/, /^CB$/) || def[0];
    const outlet = pick(def, /^ST$/, /^RM$/, /^LM$/) || def[def.length - 1];
    const support = pick(def, /^RM$/, /^LM$/, /^CM$/);
    add("counter", winner, outlet);
    add("run", outlet, goalPt(false, outlet));
    if (rich && support && support !== outlet) add("run", support, ahead(support, false, 12));
    if (rich && outlet) add("finish", outlet, goalPt(false, outlet));
    if (bplus) {
      const rest = pick(att, /^CB$/) || att[0];
      add("run", rest, drop(rest, false, 10));
      const far = pick(def, /^LM$/, /^RM$/) ;
      if (far && far !== outlet) add("run", far, ahead(far, false, 14));
    }
    return arrows;
  }

  const cm = pick(att, /^CM$/, /^CDM$/, /^CAM$/) || pick(att, /^LM$/, /^RM$/);
  const st = pick(att, /^ST$/, /^CF$/, /^SS$/);
  const wide = pick(att, /^LM$/, /^LW$/, /^LWB$/, /^RM$/, /^RW$/, /^RWB$/);
  const otherWide = att.find(
    (p) => p !== wide && /^(LM|LW|LWB|RM|RW|RWB)$/i.test(String(p.role || ""))
  );
  const cb = pick(att, /^CB$/, /^LCB$/, /^RCB$/);
  const otherCb = att.find((p) => p !== cb && /^[LR]?CB$/i.test(String(p.role || "")));
  const towardGoal = full[0]?.x >= 50;
  const passMax = bplus ? 4 : rich ? 3 : 2;

  if (rich) add("pass", cb || pick(att, /^LB$/, /^RB$/), cm || st);
  addOpenPass(
    [
      [cm, st],
      [cm, wide],
      [wide, st],
      [cm, otherWide],
      [otherWide, st],
      [cb, wide],
    ],
    passMax
  );
  add("finish", st || wide, goalPt(full.length >= 1 ? towardGoal || full.length === 2 : true, st || wide));
  if (wide && st && wide !== st) add("run", wide, ahead(wide, towardGoal || full.length !== 1, 12));
  if (rich && otherWide && otherWide !== st) add("run", otherWide, ahead(otherWide, towardGoal || full.length !== 1, 12));
  if (bplus && st) add("run", st, ahead(st, towardGoal || full.length !== 1, 10));
  if (bplus && otherWide) add("delivery", otherWide, goalPt(towardGoal || full.length === 2, otherWide));
  if (bplus && otherCb) add("run", otherCb, drop(otherCb, towardGoal || full.length === 2, 8));
  if (bplus) {
    const shadow = pick(def, /^ST$/, /^CM$/) || def[0];
    if (shadow && cm) add("press", shadow, cm);
  }
  if (!rich && st && full.length < 1) add("run", st, ahead(st, true, 10));
  return arrows;
}

function smallZoneAround(group: DrawerPlayer[], id: string, label: string): DrawerZone | null {
  if (group.length < 1) return null;
  const xs = group.map((p) => p.x);
  const ys = group.map((p) => p.y);
  const cx = xs.reduce((s, v) => s + v, 0) / xs.length;
  const cy = ys.reduce((s, v) => s + v, 0) / ys.length;
  const width = Math.max(16, Math.min(22, Math.max(...xs) - Math.min(...xs) + 8));
  const height = Math.max(16, Math.min(28, Math.max(...ys) - Math.min(...ys) + 8));
  const x = clampPercent(cx - width / 2);
  const y = Math.min(clampPercent(cy - height / 2), 100 - height);
  return {
    id,
    x,
    y,
    width: Math.min(width, 100 - x),
    height: Math.min(height, 100 - y),
    label,
  };
}

function layoutConceptZones(args: {
  players: DrawerPlayer[];
  goals: DrawerGoal[];
  phase: string;
  zone: string;
  density: DiagramDensity;
}): DrawerZone[] {
  const { players, phase, zone, density } = args;
  const defending = /DEFENDING/i.test(phase) || /DEFENSIVE_THIRD/i.test(zone);
  const att = players.filter((p) => p.team === "home");
  const def = players.filter((p) => p.team === "away");
  const zones: DrawerZone[] = [];
  const supportGroup = defending ? def.filter((p) => /ST|CM|LM|RM/i.test(p.role)) : att.filter((p) => /CM|LM|RM|ST/i.test(p.role));
  const support = smallZoneAround(supportGroup, "c-concept", defending ? "Press trap" : "Support");
  if (support) zones.push(support);
  if (density !== "bplus") return zones;
  const rest = smallZoneAround(
    att.filter((p) => /^[LR]?CB$|^LB$|^RB$/i.test(p.role)),
    "b-rest",
    "Rest defence"
  );
  if (rest) zones.push(rest);
  const shadow = smallZoneAround(
    def.filter((p) => /ST|CM|CDM/i.test(p.role)).slice(0, 2),
    "b-shadow",
    "Cover shadow"
  );
  if (shadow) zones.push(shadow);
  return zones.slice(0, 3);
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

function pickWarmupPicturePlayers(players: DrawerPlayer[]): DrawerPlayer[] {
  const home = players.filter((p) => p.team === "home");
  const away = players.filter((p) => p.team === "away");
  const neu = players.filter((p) => p.team === "neutral");
  if (away.length > 0 && home.length === away.length && home.length + away.length <= 10) {
    return [...home, ...away, ...neu.slice(0, 2)].slice(0, 10);
  }
  if (players.length <= 8) return players;
  if (away.length === 0) return home.slice(0, 8);
  const innerN = Math.min(away.length, 2);
  const neuN = Math.min(neu.length, 1);
  const outerN = Math.max(4, 8 - innerN - neuN);
  return [...home.slice(0, outerN), ...away.slice(0, innerN), ...neu.slice(0, neuN)].slice(0, 8);
}

function layoutRondo(outer: DrawerPlayer[], inner: DrawerPlayer[]): void {
  const half = 22;
  if (outer.length === 4) {
    const spots = [
      { x: 50, y: 50 - half },
      { x: 50 + half, y: 50 },
      { x: 50, y: 50 + half },
      { x: 50 - half, y: 50 },
    ];
    outer.forEach((player, i) => {
      player.x = spots[i].x;
      player.y = spots[i].y;
    });
  } else {
    outer.forEach((player, i) => {
      const angle = (Math.PI * 2 * i) / Math.max(1, outer.length) - Math.PI / 2;
      player.x = clampPercent(50 + half * Math.cos(angle));
      player.y = clampPercent(50 + half * Math.sin(angle));
    });
  }
  inner.forEach((player, i) => {
    const angle = (Math.PI * 2 * i) / Math.max(1, inner.length) + Math.PI / Math.max(2, inner.length);
    player.x = clampPercent(50 + 8 * Math.cos(angle));
    player.y = clampPercent(50 + 8 * Math.sin(angle));
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
  formationAttacking: string;
  formationDefending: string;
}): boolean {
  const { players, goals, drillType, areaZones, safeZones, annotations, formationAttacking, formationDefending } = args;
  if (!/WARMUP|TECHNICAL|CONDITIONED_GAME|TACTICAL/i.test(drillType)) return false;
  if (isWarmupPicture(drillType)) {
    replaceArray(
      players,
      pickWarmupPicturePlayers(
        players.filter((player) => player.team !== "gk" && !/^gk$/i.test(player.role))
      )
    );
    replaceArray(
      goals,
      goals.filter((goal) => goal.type !== "full")
    );
  }
  if (goals.some((goal) => goal.type === "full")) return false;
  const attack = players.filter((p) => p.team === "home");
  const defend = players.filter((p) => p.team === "away");
  const neutrals = players.filter((p) => p.team === "neutral");
  if (attack.length + defend.length < 4) return false;

  const bothWays = neutrals.length > 0 || attack.length === defend.length;
  if (bothWays) {
    replaceWithOppositeMinis(goals);
    layoutEvenSidedMinis(attack, defend, formationAttacking, formationDefending, {
      open: /CONDITIONED_GAME/i.test(drillType),
    });
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
  const box = 56;
  replaceArray(areaZones, [
    {
      id: "rondo-grid",
      x: 50 - box / 2,
      y: 50 - box / 2,
      width: box,
      height: box,
      label: "Rondo",
    },
  ]);
  replaceArray(safeZones, []);
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
  if (!/TACTICAL|CONDITIONED_GAME|FULL_GAME|TECHNICAL/i.test(drillType)) return false;
  const full = goals.filter((goal) => goal.type === "full");
  if (full.length !== 1) return false;
  const opposed = players.some((player) => player.team === "away");
    if (opposed || !/TECHNICAL/i.test(drillType)) {
    fitOutfield(players, "home", outfieldTarget(fieldFormat, formationAttacking), formationAttacking, 40);
    if (opposed) fitOutfield(players, "away", outfieldTarget(fieldFormat, formationDefending), formationDefending, 62);
  }
  const fullOnRight = full[0].x >= 50;
  const attack = players.filter((player) => player.team === "home");
  const defend = players.filter((player) => player.team === "away");
  placeFormationLines(attack, formationAttacking, fullOnRight ? [16, 36, 54, 68] : [84, 64, 46, 32], fullOnRight, {
    open: opposed,
  });
  if (defend.length) {
    placeFormationLines(defend, formationDefending, fullOnRight ? [88, 72, 58, 44] : [12, 28, 42, 56], !fullOnRight, {
      open: true,
    });
  }
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
  if (!/TACTICAL|CONDITIONED_GAME|FULL_GAME|TECHNICAL/i.test(drillType)) return false;
  const full = goals.filter((goal) => goal.type === "full");
  if (full.length !== 2) return false;
  const opposed = players.some((player) => player.team === "away");
    if (opposed || !/TECHNICAL/i.test(drillType)) {
    fitOutfield(players, "home", outfieldTarget(fieldFormat, formationAttacking), formationAttacking, 40);
    if (opposed) fitOutfield(players, "away", outfieldTarget(fieldFormat, formationDefending), formationDefending, 62);
  }
  const defendingOwnThird = /DEFENDING/i.test(phase) && /DEFENSIVE_THIRD/i.test(zone);
  const attack = players.filter((player) => player.team === "home");
  const defend = players.filter((player) => player.team === "away");
  if (defendingOwnThird) {
    placeFormationLines(attack, formationAttacking, [50, 64, 76, 86], true, { open: opposed });
    if (defend.length) placeFormationLines(defend, formationDefending, [88, 76, 64, 52], false, { open: true });
  } else {
    placeFormationLines(attack, formationAttacking, [14, 30, 44, 54], true, { open: opposed });
    if (defend.length) placeFormationLines(defend, formationDefending, [86, 70, 56, 46], false, { open: true });
  }
  return true;
}

function trimToPictureBudget(
  players: DrawerPlayer[],
  drillType: string,
  format: FieldFormat,
  goals: DrawerGoal[]
): void {
  const fullGoals = goals.filter((goal) => goal.type === "full").length;
  const cap = pictureOutfieldCap({ drillType, format, fullGoals });
  const gks = players.filter((p) => p.team === "gk" || /^gk$/i.test(p.role));
  const home = players.filter((p) => p.team === "home");
  const away = players.filter((p) => p.team === "away");
  const neu = players.filter((p) => p.team === "neutral");
  const keepGk =
    isWarmupPicture(drillType) || (/TECHNICAL/i.test(drillType) && fullGoals === 0)
      ? []
      : gks.slice(0, 2);
  if (isWarmupPicture(drillType) || (/TECHNICAL/i.test(drillType) && fullGoals === 0)) {
    replaceArray(players, pickWarmupPicturePlayers([...home, ...away, ...neu]));
    return;
  }
  const next = [
    ...keepGk,
    ...home.slice(0, cap.home),
    ...away.slice(0, cap.away),
    ...neu.slice(0, 2),
  ];
  if (next.length > cap.total) {
    replaceArray(players, next.slice(0, cap.total));
    return;
  }
  replaceArray(players, next);
}

function fitOutfield(
  players: DrawerPlayer[],
  team: "home" | "away",
  target: number,
  formation: string,
  seedX: number
): void {
  const group = players.filter((player) => player.team === team);
  while (group.length > target) {
    const extra = group.pop();
    if (!extra) break;
    const idx = players.indexOf(extra);
    if (idx >= 0) players.splice(idx, 1);
  }
  padOutfield(players, team, target, formation, seedX);
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

function shapeForEvenSide(formation: string, n: number): string {
  const nums = parseFormationNums(formation);
  if (nums && nums.reduce((sum, v) => sum + v, 0) === n) return nums.join("-");
  if (n === 5) return "2-1-2";
  if (n === 6) return "2-2-2";
  if (n === 4) return "2-2";
  return nums ? nums.join("-") : "2-2";
}

function layoutEvenSidedMinis(
  attack: DrawerPlayer[],
  defend: DrawerPlayer[],
  formationAttacking: string,
  formationDefending: string,
  opts?: { open?: boolean }
): void {
  const n = Math.min(attack.length, defend.length);
  const open = opts?.open === true;
  if (n >= 4 && n <= 6) {
    placeFormationLines(attack, shapeForEvenSide(formationAttacking, attack.length), open ? [16, 34, 48] : [22, 36, 46], true, opts);
    placeFormationLines(defend, shapeForEvenSide(formationDefending, defend.length), open ? [84, 66, 52] : [78, 64, 54], false, opts);
    return;
  }
  placeGrid(attack, 16, 40, 26, 74);
  placeGrid(defend, 60, 84, 26, 74);
}

type LineKind = "back" | "mid" | "wb" | "front";

function is352(formation: string): boolean {
  return parseFormationNums(formation)?.join("-") === "3-5-2";
}

function formationBands(formation: string): { count: number; kind: LineKind }[] | null {
  const nums = parseFormationNums(formation);
  if (!nums) return null;
  if (nums.join("-") === "3-5-2") {
    return [
      { count: 3, kind: "back" },
      { count: 3, kind: "mid" },
      { count: 2, kind: "wb" },
      { count: 2, kind: "front" },
    ];
  }
  return nums.map((count, i) => ({
    count,
    kind: (i === 0 ? "back" : i === nums.length - 1 ? "front" : "mid") as LineKind,
  }));
}

function placeFormationLines(
  group: DrawerPlayer[],
  formation: string,
  lineX: number[],
  attackingRight: boolean,
  opts?: { open?: boolean }
): void {
  if (!group.length) return;
  const bands = formationBands(formation);
  const xs =
    bands && bands.length <= lineX.length
      ? is352(formation) && lineX.length >= 4
        ? [lineX[0], lineX[1], (lineX[1] + lineX[2]) / 2, lineX[2]]
        : lineX.slice(0, bands.length)
      : lineX.slice(0, 2);
  const counts =
    bands && bands.length === xs.length && bands.reduce((sum, b) => sum + b.count, 0) === group.length
      ? bands.map((b) => b.count)
      : splitAcross(group.length, xs.length);
  const kinds: LineKind[] =
    bands && bands.length === counts.length
      ? bands.map((b) => b.kind)
      : counts.map((_, i) => (i === 0 ? "back" : i === counts.length - 1 ? "front" : "mid"));
  const queue = [...group].sort((a, b) => a.y - b.y);
  const dir = attackingRight ? 1 : -1;
  let offset = 0;
  xs.forEach((x, line) => {
    const n = counts[line] || 0;
    const kind = kinds[line] || "mid";
    const slice = queue.slice(offset, offset + n);
    offset += n;
    const ys = spreadWidth(n, kind, opts?.open === true);
    slice.forEach((player, i) => {
      player.x = clampPercent(x + dir * lineStagger(kind, n, i));
      player.y = clampPercent(ys[i]);
    });
    const lineLabels = labelsForLine(kind, n, formation);
    const byTeamLeft = [...slice].sort((a, b) => (attackingRight ? a.y - b.y : b.y - a.y));
    byTeamLeft.forEach((player, i) => {
      player.role = lineLabels[i] || player.role;
    });
  });
}

function spreadWidth(n: number, kind: LineKind, open = false): number[] {
  if (kind === "wb") return n <= 1 ? [12] : [12, 88];
  if (open) {
    if (n <= 1) return [50];
    if (n === 2) return kind === "front" ? [34, 66] : [18, 82];
    if (n === 3) return kind === "front" ? [16, 50, 84] : [14, 50, 86];
    if (n === 4) return [14, 38, 62, 86];
    return Array.from({ length: n }, (_, i) => 12 + (i / Math.max(1, n - 1)) * 76);
  }
  if (n <= 1) return [50];
  if (n === 2) return kind === "front" ? [40, 60] : [34, 66];
  if (n === 3) return kind === "front" ? [20, 50, 80] : [28, 50, 72];
  if (n === 4) return [24, 41, 59, 76];
  return Array.from({ length: n }, (_, i) => 22 + (i / Math.max(1, n - 1)) * 56);
}

/** Soccer shape, not a spreadsheet. 4-4-2 midfield stays flat; 4-3-3 mids are a triangle. */
function lineStagger(kind: LineKind, n: number, i: number): number {
  if (kind === "wb") return 6;
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

function oppositionSpecified(
  json: Record<string, unknown>,
  organization: Record<string, unknown>,
  title?: string | null
): boolean {
  const take = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(take).join("\n");
    return "";
  };
  const body = [
    title,
    json.title,
    json.format,
    json.overview,
    json.description,
    json.objective,
    take(organization.setupSteps),
  ]
    .map((value) => String(value || ""))
    .join("\n");
  if (/\b\d+\s*v\s*\d+/i.test(body)) return true;
  if (/\b\d+\s+(passive\s+|static\s+)?(defenders?|opponents?|mannequins?)\b/i.test(body)) return true;
  if (/\b\d+\s*attackers?\s+and\s+\d+\s+defenders?\b/i.test(body)) return true;
  if (/\b(opposed|live defenders?|defending team|vs\s+defen)\b/i.test(body)) return true;
  return false;
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

function stripMatchLaneZones(
  areaZones: DrawerZone[],
  safeZones: DrawerZone[],
  annotations: DrawerAnnotation[]
): void {
  const chrome = /central lane|press side|cover shadow|rest defence|activation/i;
  replaceArray(
    areaZones,
    areaZones.filter((zone) => !chrome.test(zone.label || "") && zone.height < 90)
  );
  replaceArray(
    safeZones,
    safeZones.filter((zone) => !chrome.test(zone.label || "") && zone.height < 90)
  );
  replaceArray(
    annotations,
    annotations.filter((annotation) => !chrome.test(annotation.text || ""))
  );
}

function isRawKeeper(player: Record<string, unknown>): boolean {
  const role = String(player.role || "").toUpperCase();
  const team = String(player.team || "").toUpperCase();
  return team === "GK" || role === "GK" || role.includes("GOALKEEPER");
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

function labelsForLine(kind: LineKind, n: number, formation = ""): string[] {
  if (kind === "wb") return padRoles(["LWB", "RWB"], n, "WB");
  if (kind === "back") {
    if (is352(formation) && n === 3) return ["LCB", "CB", "RCB"];
    return backLabels(n);
  }
  if (kind === "front") return frontLabels(n);
  if (is352(formation) && n === 3) return ["LCM", "CDM", "RCM"];
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

function preferredNumbersForRole(role: string): number[] {
  const r = String(role || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (r === "GK" || r.includes("KEEPER")) return [1];
  if (r === "RB" || r === "RWB" || r === "RCB") return [2, 5];
  if (r === "LB" || r === "LWB" || r === "LCB") return [3, 4];
  if (r === "CB" || r === "FB") return [4, 5, 2, 3];
  if (r === "WB") return [2, 3];
  if (r === "DM" || r === "CDM") return [6, 8];
  if (r === "RW" || r === "RM") return [7];
  if (r === "CM" || r === "MF") return [8, 6, 10];
  if (r === "ST" || r === "CF" || r === "FW") return [9];
  if (r === "AM" || r === "CAM") return [10];
  if (r === "LW" || r === "LM") return [11];
  return [];
}

function nextFreeNumber(used: Set<number>): number {
  let n = 1;
  while (used.has(n)) n += 1;
  return n;
}

/** Unique 1-99 per team. Keep existing unique numbers; fill gaps from role, then sequential. */
function ensureShirtNumbers(players: DrawerPlayer[]): void {
  const byTeam = new Map<string, DrawerPlayer[]>();
  for (const player of players) {
    const list = byTeam.get(player.team) || [];
    list.push(player);
    byTeam.set(player.team, list);
  }
  for (const group of byTeam.values()) {
    const used = new Set<number>();
    const keep = new Set<DrawerPlayer>();
    const seen = new Map<number, DrawerPlayer>();
    for (const player of group) {
      const n = Number(player.number);
      if (!Number.isInteger(n) || n < 1 || n > 99) continue;
      if (seen.has(n)) continue;
      seen.set(n, player);
      used.add(n);
      keep.add(player);
    }
    for (const player of group) {
      if (keep.has(player)) continue;
      let assigned = 0;
      for (const candidate of preferredNumbersForRole(player.role)) {
        if (!used.has(candidate)) {
          assigned = candidate;
          break;
        }
      }
      if (!assigned) assigned = nextFreeNumber(used);
      player.number = assigned;
      used.add(assigned);
    }
  }
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
