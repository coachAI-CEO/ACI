import { TOKEN_RADIUS_BASELINE, isWarmupPicture, practiceSpaceYards, type FieldFormat } from "../data/field-dimensions";
import type { DrawerParams, DrawerPlayer } from "../types/drawer";
import {
  dropBackLineToOwnHalf,
  fitGroupInCenter,
  groupFrame,
  mapPoint,
  pinGoalsToEnds,
  separatePlayers,
  shiftIfNearAway,
  snapKeepersToGoals,
} from "./scene-space";

export const SCENE_PROMPT_VERSION = "scene-xy-v1";

export type ScenePicture = "rondo" | "center" | "matchup" | "block";

export type SceneCard = {
  title: string;
  card: string;
  drillType: string;
  fieldFormat: FieldFormat;
  spaceConstraint: string;
  formationAttacking: string;
  formationDefending: string;
  coachLevel?: string;
  picture?: ScenePicture;
  phase?: string;
  zone?: string;
  gameModelId?: string;
  durationMin?: number;
  rpeMin?: number;
  rpeMax?: number;
};

export type ModelScene = {
  note?: string;
  widthYards?: number;
  lengthYards?: number;
  players: Array<{
    id?: string;
    team?: string;
    number?: number;
    role?: string;
    label?: string;
    x: number;
    y: number;
  }>;
  goals?: Array<{
    id?: string;
    type?: string;
    x: number;
    y: number;
    width?: number;
  }>;
  arrows?: Array<{
    id?: string;
    type?: string;
    from: { x: number; y: number };
    to: { x: number; y: number };
    label?: string;
  }>;
  zones?: Array<{
    id?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    label?: string;
  }>;
  annotations?: Array<{
    id?: string;
    text: string;
    x: number;
    y: number;
  }>;
};

function clamp(n: number, min = 0, max = 100): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function teamOf(raw: string | undefined, role: string): DrawerPlayer["team"] {
  const t = String(raw || "").toUpperCase();
  const r = String(role || "").toUpperCase();
  if (r === "GK" || t === "GK") return "gk";
  if (t === "AWAY" || t === "DEF" || t === "RED") return "away";
  if (t === "NEUTRAL" || t === "N") return "neutral";
  return "home";
}

function goalType(raw: string | undefined): "full" | "mini" | "gate" {
  const t = String(raw || "").toUpperCase();
  if (t === "MINI" || t === "SMALL" || t === "PUGG") return "mini";
  if (t === "GATE") return "gate";
  return "full";
}

function arrowType(
  raw: string | undefined
): "pass" | "run" | "press" | "movement" | "counter" | "delivery" | "finish" {
  const t = String(raw || "").toLowerCase();
  if (t === "run" || t === "press" || t === "movement" || t === "counter" || t === "delivery" || t === "finish") {
    return t;
  }
  return "pass";
}

function fieldFormatOf(card: SceneCard): FieldFormat {
  const raw = String(card.fieldFormat || "9V9").toUpperCase();
  if (raw === "7V7" || raw === "11V11") return raw;
  return "9V9";
}

export function hideMatchMarkings(card: SceneCard): boolean {
  return isWarmupPicture(card.drillType) || String(card.spaceConstraint || "").toUpperCase() !== "FULL";
}

/** Paint model XY as-is. Do not send this through drillToDrawerParams. */
export function sceneToDrawerParams(card: SceneCard, scene: ModelScene): DrawerParams {
  const format = fieldFormatOf(card);
  const space = practiceSpaceYards(format, String(card.spaceConstraint || "FULL"));
  let players: DrawerPlayer[] = (scene.players || []).map((p, i) => {
    const role = String(p.role || "CM");
    const team = teamOf(p.team, role);
    return {
      id: String(p.id || `${team}-${i + 1}`),
      number: Number(p.number) > 0 ? Number(p.number) : i + 1,
      team,
      role,
      x: clamp(Number(p.x)),
      y: clamp(Number(p.y)),
      label: p.label ? String(p.label) : undefined,
    };
  });

  const rondo = card.picture === "rondo";
  const compact = rondo || card.picture === "center";
  const span = rondo ? 34 : 38;
  const frame = compact && players.length >= 2 ? groupFrame(players, span) : null;
  if (frame) players = fitGroupInCenter(players, span);
  players = separatePlayers(
    players,
    String(card.coachLevel || "").toUpperCase() === "USSF_B_PLUS"
      ? 6
      : rondo || card.picture === "center"
        ? 8
        : scene.players && scene.players.length > 14
          ? 7
          : 11
  );

  const map = (pt: { x: number; y: number }) => (frame ? mapPoint(pt, frame) : pt);
  let goals = rondo
    ? []
    : (scene.goals || []).map((g, i) => {
        const pt = map({ x: Number(g.x), y: Number(g.y) });
        return {
          id: String(g.id || `G-${i + 1}`),
          x: clamp(pt.x),
          y: clamp(pt.y),
          width: Number(g.width) > 0 ? Number(g.width) : 8,
          type: goalType(g.type),
        };
      });
  goals = pinGoalsToEnds(goals);
  players = snapKeepersToGoals(players, goals);

  let backsBefore: DrawerPlayer[] = [];
  let defShift = 0;
  if (card.picture === "matchup") {
    const held = dropBackLineToOwnHalf(players);
    backsBefore = held.moved;
    defShift = held.shiftX;
    players = held.players;
    players = separatePlayers(
      players,
      String(card.coachLevel || "").toUpperCase() === "USSF_B_PLUS" ? 6 : scene.players && scene.players.length > 14 ? 7 : 11
    );
  }

  return {
    title: card.title,
    drillType: card.drillType,
    format,
    fieldFormat: format,
    phase: card.phase || "ATTACKING",
    zone: card.zone || "MIDDLE_THIRD",
    gameModelId: card.gameModelId || "POSSESSION",
    formationAttacking: card.formationAttacking,
    formationDefending: card.formationDefending,
    durationMin: card.durationMin ?? 12,
    rpeMin: card.rpeMin ?? 4,
    rpeMax: card.rpeMax ?? 6,
    widthYards: Number(scene.widthYards) > 0 ? Number(scene.widthYards) : space.widthYards,
    lengthYards: Number(scene.lengthYards) > 0 ? Number(scene.lengthYards) : space.lengthYards,
    players,
    goals,
    arrows: (scene.arrows || []).map((a, i) => {
      const from = shiftIfNearAway(map({ x: Number(a.from?.x), y: Number(a.from?.y) }), backsBefore, defShift);
      const to = shiftIfNearAway(map({ x: Number(a.to?.x), y: Number(a.to?.y) }), backsBefore, defShift);
      return {
        id: String(a.id || `A-${i + 1}`),
        from: { x: clamp(from.x), y: clamp(from.y) },
        to: { x: clamp(to.x), y: clamp(to.y) },
        type: arrowType(a.type),
        label: a.label ? String(a.label) : undefined,
      };
    }),
    zones: (scene.zones || [])
      .filter((z) => Number(z.width) * Number(z.height) < 5000)
      .map((z, i) => ({
        id: String(z.id || `Z-${i + 1}`),
        x: clamp(Number(z.x)),
        y: clamp(Number(z.y)),
        width: clamp(Number(z.width), 1, 100),
        height: clamp(Number(z.height), 1, 100),
        label: z.label ? String(z.label) : undefined,
      })),
    annotations: (scene.annotations || [])
      .filter((a) => a && a.text)
      .map((a, i) => {
        const pt = shiftIfNearAway(map({ x: Number(a.x), y: Number(a.y) }), backsBefore, defShift);
        return {
          id: String(a.id || `N-${i + 1}`),
          text: String(a.text).slice(0, 80),
          x: clamp(pt.x),
          y: clamp(pt.y),
        };
      }),
    coachingPoints: scene.note ? [String(scene.note).slice(0, 220)] : [],
    primaryCoachingPicture: scene.note ? String(scene.note).slice(0, 220) : card.card.split("\n")[0],
    coach: null,
    hideMatchPitchMarkings: hideMatchMarkings(card),
    lockTokenRadius: String(card.coachLevel || "").toUpperCase() === "USSF_B_PLUS" ? 11 : TOKEN_RADIUS_BASELINE,
  };
}

export function promptForScene(card: SceneCard): string {
  const level = String(card.coachLevel || "USSF_D").toUpperCase();
  const detail =
    level === "USSF_B_PLUS"
      ? `DIAGRAM DETAIL: USSF_B_PLUS (richest). 7-10 arrows, 4-6 annotations, 2-3 small zones. Layered labels (rest defence AND the next action). Fluent, connected — not a vocab list.`
      : level === "USSF_C"
        ? `DIAGRAM DETAIL: USSF_C. 5-7 arrows, 3-4 annotations, 1-2 small zones. Name ONE concept and explain it. No rest-defence/cover-shadow/blindside stacking.`
        : `DIAGRAM DETAIL: USSF_D SIMPLE. 2-4 arrows, 1-2 annotations, 0-1 zones. Grass words. No zone overlay over the whole pitch.`;

  return `You draw a football TRAINING picture as JSON. Same painter as production (percent pitch).
Pitch coords: origin top-left, x right, y down, both 0-100 on the GRASS.
Draw THIS practice, not a generic 11v11 dump. Counts and shape in the practice text are law.
${detail}

Return ONLY JSON:
{
  "note": "one coach sentence that belongs ON the figure",
  "widthYards": number,
  "lengthYards": number,
  "players": [{ "id", "team": "home"|"away"|"neutral"|"gk", "number", "role", "label", "x", "y" }],
  "goals": [{ "id", "type": "full"|"mini"|"gate", "x", "y", "width" }],
  "arrows": [{ "id", "type": "pass"|"run"|"press", "from": {"x","y"}, "to": {"x","y"} }],
  "zones": [{ "id", "x", "y", "width", "height", "label" }],
  "annotations": [{ "text", "x", "y" }]
}

home = blue ATT, away = red DEF, gk = black keeper, neutral = yellow.
Keepers only if the practice has a full goal. Each GK sits ON that goal line, same y as the posts (centred in the mouth). Never offset up or down from the goal.
Full goals are on the LEFT and RIGHT ends only (x 0 and 100, y 50). Never put a full goal on the top or bottom touchline.
Arrows miss shirts. Labels like N1/B4 are good when they teach.
Leave air between shirts: at least ~${level === "USSF_B_PLUS" ? "7" : "10"} on this 0-100 pitch between any two centres.
If the practice is a RONDO: one small square in the MIDDLE (around 50,50). Defender in the centre of the ring. Blues around. Do not stretch it to the touchlines or draw two separate games.
If the practice is a 1v1 or a short channel: put that channel in the MIDDLE. Few shirts. One mini goal. Not a squad.
If the practice is two teams (5v5, 8v8, a switch): use the box, facing each other — they should not share the same spine.
Defending team (red, away): back line in THEIR half, between the ball and their GK. A ball-side shift is fine; a high line on the halfway is not, unless the card is a press.
Do not invent a full match if the card is a rondo, 5v5, or a middle-third block.
Skip a zone that covers the whole pitch; cones/goals already mark the box.
Named shirts and named actions beat a vague headcount. If the card names a 2v1, draw that 2v1 — do not invent a leftover squad to hit "~8 shirts".
If the card names a flank or channel, put the action in that band, not on the spine.

THE PRACTICE:
${card.card}`;
}

export function extractScene(raw: string): ModelScene {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model returned no JSON object");
  const parsed = JSON.parse(trimmed.slice(start, end + 1)) as ModelScene;
  if (!parsed || !Array.isArray(parsed.players) || parsed.players.length < 2) {
    throw new Error("JSON missing a usable players[]");
  }
  return parsed;
}
