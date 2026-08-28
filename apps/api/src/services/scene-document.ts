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
} from "./scene-space";
import { enforceSceneKit, fixRoleSides, relabelFromRoster } from "./scene-kit";
import { parseWebDiagramV1 } from "./board-diagram-schema";
import { toWebDiagramV1, type WebDiagramV1 } from "./web-diagram-v1";

export const SCENE_PROMPT_VERSION = "scene-webv1-v1";

/** The scene model now emits WebDiagramV1 (shared with the tactical board). */
export type SceneDiagram = WebDiagramV1;

export type ScenePicture = "rondo" | "center" | "matchup" | "block";

export type SceneCard = {
  title: string;
  card: string;
  drillType: string;
  fieldFormat: FieldFormat;
  spaceConstraint: string;
  /** FULL-size goals with a GK. <= 0 means mini-goals/gates only, no keeper. */
  goalsAvailable?: number;
  /** Explicit per-side role list from the setup text, when the card names one. */
  roster?: { home: string[]; away: string[] };
  /** Two-team game picture: both sides need something to score into. */
  twoTeamGame?: boolean;
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

function clamp(n: number, min = 0, max = 100): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function roleOf(raw: string | undefined): string {
  const r = String(raw || "").trim();
  const key = r.toLowerCase();
  if (key === "attacker" || key === "att" || key === "attack") return "FW";
  if (key === "defender" || key === "def" || key === "defend") return "CB";
  if (key === "target") return "ST";
  return r || "CM";
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
  if (t === "cover") return "press";
  if (t === "transition") return "counter";
  return "pass";
}

function fieldFormatOf(card: SceneCard): FieldFormat {
  const raw = String(card.fieldFormat || "9V9").toUpperCase();
  if (raw === "7V7" || raw === "11V11") return raw;
  return "9V9";
}

export function hideMatchMarkings(card: SceneCard): boolean {
  const type = String(card.drillType || "").toUpperCase();
  return isWarmupPicture(type) || type.includes("TECHNICAL") || String(card.spaceConstraint || "").toUpperCase() !== "FULL";
}

/** A "defensive third" overlay covering most of the pitch is chrome, not a small teaching box. */
export function isUsableSceneZone(zone: { width?: number; height?: number } | null | undefined): boolean {
  const width = Number(zone?.width);
  const height = Number(zone?.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return false;
  if (width >= 70 || height >= 70) return false;
  if (width >= 40 && height >= 40) return false;
  return width * height < 1200;
}

/** Resolve a WebDiagramV1 arrow endpoint (playerId or x/y) to a plain point. */
function resolveRef(
  ref: { playerId?: string; x?: number; y?: number } | undefined,
  players: DrawerPlayer[]
): { x: number; y: number } {
  if (ref?.playerId) {
    const p = players.find((pl) => pl.id === ref.playerId);
    if (p) return { x: p.x, y: p.y };
  }
  return { x: clamp(Number(ref?.x)), y: clamp(Number(ref?.y)) };
}

/** Paint a WebDiagramV1 scene through the TE painter. Do not use drillToDrawerParams. */
export function sceneToDrawerParams(card: SceneCard, scene: SceneDiagram): DrawerParams {
  const format = fieldFormatOf(card);
  const space = practiceSpaceYards(format, String(card.spaceConstraint || "FULL"));
  const rawPlayerCount = (scene.players || []).length;
  let players: DrawerPlayer[] = (scene.players || []).map((p, i) => {
    const role = roleOf(p.role);
    const team = teamOf(p.team, role);
    return {
      id: String(p.id || `${team}-${i + 1}`),
      number: Number(p.number) > 0 ? Number(p.number) : i + 1,
      team,
      role,
      x: clamp(Number(p.x)),
      y: clamp(Number(p.y)),
      label: p.role ? String(p.role) : undefined,
    };
  });

  players = relabelFromRoster(players, card.roster);
  players = fixRoleSides(players);

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
        : rawPlayerCount > 14
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
          type: goalType(g.type ?? undefined),
        };
      });
  goals = pinGoalsToEnds(goals);
  // Reconcile keepers + full goals against the card's kit line. Owns the
  // former inline "strip keepers for WARMUP|TECHNICAL" rule plus the
  // goalsAvailable===0 and orphan-keeper cases. Deterministic, idempotent.
  ({ players, goals } = enforceSceneKit(players, goals, {
    goalsAvailable: card.goalsAvailable,
    drillType: card.drillType,
    defensiveTarget: Boolean(card.twoTeamGame),
  }));

  let backsBefore: DrawerPlayer[] = [];
  let defShift = 0;
  if (card.picture === "matchup") {
    const held = dropBackLineToOwnHalf(players);
    backsBefore = held.moved;
    defShift = held.shiftX;
    players = held.players;
    players = separatePlayers(
      players,
      String(card.coachLevel || "").toUpperCase() === "USSF_B_PLUS" ? 6 : rawPlayerCount > 14 ? 7 : 11
    );
  }

  const arrows = [...(scene.arrows || [])]
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    .map((a, i) => {
      const from = shiftIfNearAway(map(resolveRef(a.from, players)), backsBefore, defShift);
      const to = shiftIfNearAway(map(resolveRef(a.to, players)), backsBefore, defShift);
      return {
        id: `A-${i + 1}`,
        from: { x: clamp(from.x), y: clamp(from.y) },
        to: { x: clamp(to.x), y: clamp(to.y) },
        type: arrowType(a.type),
        label: undefined as string | undefined,
      };
    });

  // Exactly one ball. If the model gave none, start it where the first arrow
  // starts (usually a pass/carry) or at centre. Then snap the first arrow's
  // start onto the ball so the picture reads "the ball goes here next".
  const rawBall = (scene.balls || [])[0];
  const ball = rawBall
    ? (() => {
        const pt = map({ x: Number(rawBall.x), y: Number(rawBall.y) });
        return { x: clamp(pt.x), y: clamp(pt.y) };
      })()
    : arrows[0]
      ? { ...arrows[0].from }
      : { x: 50, y: 50 };
  if (arrows[0]) arrows[0].from = { ...ball };

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
    widthYards: space.widthYards,
    lengthYards: space.lengthYards,
    players,
    goals,
    ball,
    arrows,
    zones: (scene.areas || [])
      .filter((z) => isUsableSceneZone(z))
      .map((z, i) => ({
        id: `Z-${i + 1}`,
        x: clamp(Number(z.x)),
        y: clamp(Number(z.y)),
        width: clamp(Number(z.width), 1, 100),
        height: clamp(Number(z.height), 1, 100),
        label: z.label ? String(z.label) : undefined,
      })),
    annotations: (scene.labels || [])
      .filter((a) => a && a.text)
      .map((a, i) => {
        const pt = shiftIfNearAway(map({ x: Number(a.x), y: Number(a.y) }), backsBefore, defShift);
        return {
          id: `N-${i + 1}`,
          text: String(a.text).slice(0, 80),
          x: clamp(pt.x),
          y: clamp(pt.y),
        };
      }),
    coachingPoints: [],
    primaryCoachingPicture: card.card.split("\n")[0],
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
        ? `DIAGRAM DETAIL: USSF_C. 5-7 arrows, 3-4 annotations, 0-1 SMALL zones (a channel or a box — never a third of the pitch). Name ONE concept and explain it. No rest-defence/cover-shadow/blindside stacking.`
        : `DIAGRAM DETAIL: USSF_D SIMPLE. 2-4 arrows, 1-2 annotations, 0-1 zones. Grass words. No zone overlay over the whole pitch.`;

  return `You draw a football TRAINING picture as JSON. Same painter as production (percent pitch).
Pitch coords: origin top-left, x right, y down, both 0-100 on the GRASS.
Draw THIS practice, not a generic 11v11 dump. Counts and shape in the practice text are law.
SHIRT COUNT follows the card's "About N players" / named NvN, NOT the pitch format. A 7V7 pitch with "About 6-8 players" is 6-8 shirts total, not 14.
If the card has a ROSTER line, it is LAW: draw exactly those shirts, one per listed label, use each label verbatim in the "label" field, add no other players. Do not rename LC/RC/LM to CM or fall back to FW/CB/DF.
If the card gives the DEFENDING team its own target (a counter gate, a line to dribble over, "N passes out"), draw that target — a mini-goal or gate on the opposite end from the attackers' goals — and one counter arrow from the defending block toward it.
NO GOALKEEPER unless the card's kit line names a full-size goal. "Mini-goals / gates only" or "No GK" means ZERO keepers — do not place a black gk token anywhere, on a net or otherwise.
${detail}

Return ONLY JSON (all coords 0-100):
{
  "players": [{ "id": "b1", "team": "home"|"away"|"neutral"|"gk", "role": "LM", "x": 30, "y": 40 }],
  "goals": [{ "id": "g1", "type": "full"|"mini"|"gate", "x": 0, "y": 50, "width": 8 }],
  "balls": [{ "x": 35, "y": 50 }],
  "arrows": [{ "type": "pass"|"run"|"press", "order": 1, "from": {"playerId": "b1"}, "to": {"x": 50, "y": 40} }],
  "areas": [{ "label": "Trap zone", "x": 55, "y": 20, "width": 18, "height": 16 }],
  "labels": [{ "text": "Press on the backward pass", "x": 45, "y": 22 }]
}

Put the shirt's exact role code in "role" (LM, RCB, ST...) — that IS the label.
"arrows[].from"/"to" is a player: {"playerId":"b1"} OR a point: {"x":50,"y":40}.
Place EXACTLY ONE ball. The first arrow (order 1) starts at the ball.
home = blue ATT, away = red DEF, gk = black keeper, neutral = yellow.
Keepers only if the practice has a full goal. Each GK sits ON that goal line, same y as the posts (centred in the mouth). Never offset up or down from the goal.
Full goals are on the LEFT and RIGHT ends only (x 0 and 100, y 50). Never put a full goal on the top or bottom touchline.
Mini-goals / gates sit on an END line too (x near 3 or 97), never on the top or bottom touchline (never y near 0 or 100). Two minis as a vertical pair (y 38 and 62) on one end.
If the practice has TWO full-size goals: one left and one right (x 0 and 100, y 50), with a GK in each. No mini-goals.
If the practice has ONE full-size goal, also draw TWO mini-goals on the opposite end (x 3 or 97, y 38 and 62). No GK on the minis.
Arrows miss shirts. Labels like N1/B4 are good when they teach.
Leave air between shirts: at least ~${level === "USSF_B_PLUS" ? "7" : "10"} on this 0-100 pitch between any two centres.
If the practice is a RONDO: one small square in the MIDDLE (around 50,50). Defender in the centre of the ring. Blues around. Do not stretch it to the touchlines or draw two separate games.
If the practice is a 1v1 or a short channel: put that channel in the MIDDLE. Few shirts. One mini goal. Not a squad.
If the practice is TECHNICAL or WARMUP: ONE working group only (about 6-10 shirts). If setup says two grids or two groups, draw ONE grid. A passing circuit is three short lines — start, link, target — toward mini-goals. Not two colours of a 9v9.
If the practice is two teams (5v5, 8v8, 9v9, a switch, a conditioned game): use the box, facing each other — they should not share the same spine. 9v9 is 8 outfield + GK per colour, not a leftover 4-3-3.
Defending team (red, away): back line in THEIR half, between the ball and their GK. A ball-side shift is fine; a high line on the halfway is not, unless the card is a press.
A role's L/R prefix is that team's OWN left/right facing their attack, and the teams face opposite ways. home attacks right: home L* at the TOP (low y), home R* at the BOTTOM (high y). away is mirrored: away L* at the BOTTOM, away R* at the TOP. Getting away's L/R backwards is the usual mistake — check it.
Do not invent a full match if the card is a rondo, 5v5, or a middle-third block.
Skip a zone that covers the whole pitch or a third of it; cones/goals already mark the box. A zone must be a SMALL square or channel (never height or width >= 70). Teach "defensive third" with an arrow and a short label, not a cone rectangle.
Named shirts and named actions beat a vague headcount. If the card names a 2v1, draw that 2v1 — do not invent a leftover squad to hit "~8 shirts".
If the card names a flank or channel, put the action in that band, not on the spine.

THE PRACTICE:
${card.card}`;
}

export function extractScene(raw: string): SceneDiagram {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model returned no JSON object");
  let loose: unknown;
  try {
    loose = JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    throw new Error("Model returned invalid JSON");
  }
  // Coerce the model's loose output (home/away, movement arrows, label field,
  // missing style/weight, synthesises pitch) into strict WebDiagramV1, then
  // validate with the same schema the board uses.
  const coerced = toWebDiagramV1(loose);
  if (!coerced) throw new Error("Model output could not be coerced to a diagram");
  const parsed = parseWebDiagramV1(coerced);
  if (!parsed.ok) throw new Error(`Invalid diagram: ${parsed.error}`);
  if ((parsed.diagram.players || []).length < 2) throw new Error("Diagram has no usable players[]");
  return parsed.diagram;
}
