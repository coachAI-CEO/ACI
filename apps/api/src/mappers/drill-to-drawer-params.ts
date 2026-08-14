import type { Drill } from "@prisma/client";
import { randomUUID } from "crypto";
import {
  computeContentWindow,
  computeTokenRadius,
  remapToWindow,
  resolveFieldFormat,
  shouldZoomOut,
  type FieldFormat,
} from "../data/field-dimensions";
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
>;

export function drillToDrawerParams(drill: DrillLike): DrawerParams {
  const json = asRecord(drill.json);
  const diagram = asRecord(json.diagram ?? json.diagramV1);
  const organization = asRecord(json.organization);
  const area = asRecord(organization.area);
  const rawPlayers = Array.isArray(diagram.players) ? diagram.players : [];

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

  const areaZones: DrawerZone[] = (Array.isArray(diagram.areas) ? diagram.areas : []).map((raw: unknown, idx: number) => {
    const z = asRecord(raw);
    return {
      id: stringOr(z.id, `zone-${idx}`),
      x: clampPercent(z.x ?? 0),
      y: clampPercent(z.y ?? 0),
      width: clampPercent(z.width ?? 0),
      height: clampPercent(z.height ?? 0),
      label: typeof z.label === "string" ? z.label : undefined,
    };
  });

  const safeZones: DrawerZone[] = (Array.isArray(diagram.safeZones) ? diagram.safeZones : []).map((raw: unknown, idx: number) => {
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
  });
  const coachingPoints = extractCoachingPoints(json);
  const annotations = buildDrawerAnnotations(diagram, [...areaZones, ...safeZones], coachingPoints);

  const widthYardsValue = numberOr(area.widthYards, 30);
  const lengthYardsValue = numberOr(area.lengthYards, 40);
  const fieldFormatValue = resolveDrawerFieldFormat(json.fieldFormat, players.length);

  // The field rect is always drawn at the same fixed size, representing the
  // drill's declared area -- but players/zones only ever occupied whatever
  // raw 0-100 percent coordinates the model gave them, which (especially
  // for a small enclosed grid relative to a real full-size pitch) tends to
  // cluster in one corner rather than spanning the box. When this drill's
  // area is small relative to a real pitch (shouldZoomOut), reframe the
  // camera to the drill's actual content instead of the raw coordinate
  // space, so the box fills with the real action instead of mostly empty
  // field. Full-size/near-full-size drills (shouldZoomOut false) are left
  // untouched -- their content already reasonably fills the box.
  if (shouldZoomOut(widthYardsValue, lengthYardsValue, fieldFormatValue)) {
    const contentPoints = [
      ...players.map((p) => ({ x: p.x, y: p.y })),
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
    // A goal positioned for a real match pitch (e.g. a full-size goal ~50+
    // yards from a small warmup grid) falls well outside the content
    // window -- drop it rather than remap it into the frame, since drawing
    // it there would misrepresent a goal the drill doesn't actually use as
    // sitting right next to the grid.
    goals = goals
      .filter((goal) => withinWindow(goal.x, goal.y))
      .map((goal) => ({ ...goal, x: remapX(goal.x), y: remapY(goal.y) }));
  }

  // Detection alone (the spacing scorer) doesn't stop overlapping tokens
  // from shipping -- nothing corrected the model's raw positions. This
  // nudges any players whose tokens would visually collide apart, in real
  // pixel space (not raw percent distance, which is misleading on a
  // non-square field), using the same token-radius math both renderers use
  // to draw. Runs once here so both renderers draw from already-resolved
  // positions instead of needing their own collision logic.
  resolveOverlaps(players, computeTokenRadius(widthYardsValue, lengthYardsValue, fieldFormatValue, players.length));

  return {
    title: drill.title || stringOr(json.title, "Drill"),
    drillType: String(drill.drillType ?? json.drillType ?? "TECHNICAL"),
    format: deriveFormat(json, drill),
    phase: stringOr(json.phase, ""),
    zone: stringOr(json.zone, ""),
    gameModelId: stringOr(json.gameModelId, ""),
    fieldFormat: fieldFormatValue,
    formationAttacking: stringOr(json.formationAttacking, ""),
    formationDefending: stringOr(json.formationDefending, ""),
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
  };
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

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clampPercent(value: unknown): number {
  return Math.max(0, Math.min(100, numberOr(value, 0)));
}
