import { generateText, setMetricsContext, clearMetricsContext } from '../gemini';
import { parseWebDiagramV1 } from './board-diagram-schema';
import { toWebDiagramV1, type WebDiagramV1 } from './web-diagram-v1';
import {
  getClubPhilosophy,
  philosophyHasContent,
  type ClubPhilosophyStages,
} from './club-philosophy';
import { getGameModelTemplate, getGameModelTemplatePhilosophy } from './game-model-templates';
import { applyPlayOutSequenceToDiagram, isPlayOutRequest, inferDefBlockHeight, labelStackAwayFromEmphasis, needsPlayOutMotifClarification, hasPlayOutMotifLock, assistantOfferedPlayOutMotif, playOutMotifOptions } from './board-phase-placement';
import {
  buildFormationPlaybookGuidance,
  type FormationId11,
} from './formation-principles';
import {
  isSessionImproveRequest,
  runBoardSessionBridge,
  type BoardSessionParams,
  type BoardSessionRecommendation,
} from './board-session-bridge';

export type BoardAiChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type BoardAiChatResult = {
  reply: string;
  applied: boolean;
  diagram: WebDiagramV1;
  coachLevel: BoardCoachLevel;
  playerLevel: BoardPlayerLevel;
  /** Present when coach asked how to train / improve the board scenario. */
  sessionBridge?: {
    params: BoardSessionParams;
    recommendations: BoardSessionRecommendation[];
    generatorUrl: string;
    generatorPrompt: string;
  };
};

export type BoardCoachLevel = 'USSF_D' | 'USSF_C' | 'USSF_B_PLUS';
export type BoardPlayerLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export type BoardAudience = {
  coachLevel: BoardCoachLevel;
  playerLevel: BoardPlayerLevel;
};

/** Coach level from user profile; player level is derived (Beginner only for D). */
export function normalizeBoardCoachLevel(value: unknown): BoardCoachLevel {
  const v = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  if (v === 'USSF_C' || v === 'C') return 'USSF_C';
  if (v === 'USSF_B_PLUS' || v === 'USSF_B+' || v === 'USSF_B' || v === 'B+' || v === 'B') {
    return 'USSF_B_PLUS';
  }
  return 'USSF_D';
}

function ageYears(ageGroup?: string | null): number | null {
  const n = parseInt(String(ageGroup || '').replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Player level is related to coach level (not a free board picker):
 * - USSF_D → BEGINNER (INTERMEDIATE from U13+)
 * - USSF_C / B+ → never BEGINNER; Intermediate floor, Advanced for older ages
 */
export function resolveBoardAudience(input: {
  coachLevel?: string | null;
  ageGroup?: string | null;
}): BoardAudience {
  const coachLevel = normalizeBoardCoachLevel(input.coachLevel);
  const years = ageYears(input.ageGroup);

  if (coachLevel === 'USSF_D') {
    return {
      coachLevel,
      playerLevel: years != null && years >= 13 ? 'INTERMEDIATE' : 'BEGINNER',
    };
  }

  if (coachLevel === 'USSF_B_PLUS') {
    return {
      coachLevel,
      playerLevel: years != null && years >= 15 ? 'ADVANCED' : 'INTERMEDIATE',
    };
  }

  // USSF_C
  return {
    coachLevel,
    playerLevel: years != null && years >= 16 ? 'ADVANCED' : 'INTERMEDIATE',
  };
}

function buildBoardLanguageGuidance(audience: BoardAudience): string {
  const { coachLevel, playerLevel } = audience;
  const lines = [
    'COACH / PLAYER LANGUAGE LOCK (MANDATORY):',
    `- coachLevel=${coachLevel} comes from the user profile (Settings) — do not invent a different license level.`,
    `- playerLevel=${playerLevel} is derived from coach level (+ board age group). Beginner is only valid for USSF_D.`,
    '- coachLevel controls VOCABULARY and diagram density. playerLevel controls how hard the player cues are.',
  ];

  if (coachLevel === 'USSF_D') {
    lines.push(
      'USSF_D vocabulary: clear, practical, run-it-now language.',
      'Banned textbook jargon (write ordinary sentences instead): overload, half-space, third-man, rest defense, pressing trigger, mid-block, positional play, etc.',
      'Diagram density: simple — about 3–4 arrows, 1 explanatory caption, 1 highlight.'
    );
  } else if (coachLevel === 'USSF_C') {
    lines.push(
      'USSF_C vocabulary: name ONE concept at a time (pressing trigger, support angle, switch of play) and explain it in the same/next sentence.',
      'Avoid B+ layered language (rest defense, cover shadow, blindside run fused into one clause).',
      'Diagram density: about 5–7 arrows, 2–3 captions, 1–2 zones.'
    );
  } else {
    lines.push(
      'USSF_B_PLUS vocabulary: fluent systemic language — rest defence, cover shadow, phase interactions (build-up shaping the press).',
      'If a B+ caption could be mistaken for C, add a layered concept.',
      'Diagram density: richest — about 7–10 arrows, 3–5 captions, 2–3 zones.'
    );
  }

  if (playerLevel === 'BEGINNER') {
    lines.push(
      'BEGINNER demand: one job per player, generous time on the ball, no 1–2 touch locks, concrete cues (“go to the ball”).'
    );
  } else if (playerLevel === 'INTERMEDIATE') {
    lines.push(
      'INTERMEDIATE demand: light combined reads OK (scan + press); avoid stacking three constraints at once.'
    );
  } else {
    lines.push(
      'ADVANCED demand: tight time/space, multiple simultaneous reads, game-realistic pressure cues are expected.'
    );
  }

  lines.push(
    'Captions must still narrate the picture with shirt numbers, written at this coach vocabulary and player demand.'
  );
  return lines.join('\n');
}

type BoardPlayModelContext = {
  gameModelId: string;
  clubName?: string | null;
  source: 'club_philosophy' | 'game_model_template' | 'id_only';
  philosophy?: ClubPhilosophyStages | null;
  summary?: string | null;
};

function parseJsonObject(text: string): any | null {
  try {
    const cleaned = text.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
    return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

function compactDiagram(diagram: WebDiagramV1): WebDiagramV1 {
  const compactLayers = (d: {
    players?: WebDiagramV1['players'];
    arrows?: WebDiagramV1['arrows'];
    areas?: WebDiagramV1['areas'];
    labels?: WebDiagramV1['labels'];
    balls?: WebDiagramV1['balls'];
    goals?: WebDiagramV1['goals'];
    coach?: WebDiagramV1['coach'];
    cones?: WebDiagramV1['cones'];
  }) => ({
    players: (d.players || []).map((p) => ({
      id: p.id,
      number: p.number,
      team: p.team,
      role: p.role,
      x: p.x,
      y: p.y,
    })),
    arrows: (d.arrows || []).map((a) => ({
      from: a.from,
      to: a.to,
      type: a.type,
      style: a.style,
      weight: a.weight,
      ...(typeof a.arrowhead === 'boolean' ? { arrowhead: a.arrowhead } : {}),
      ...(a.control ? { control: a.control } : {}),
      ...(a.path && a.path.length >= 2 ? { path: a.path.slice(0, 40) } : {}),
    })),
    areas: d.areas || [],
    labels: d.labels || [],
    balls: d.balls || [],
    goals: d.goals,
    ...(d.coach ? { coach: d.coach } : {}),
    ...(d.cones ? { cones: d.cones } : {}),
  });

  const root = {
    ...diagram,
    ...compactLayers(diagram),
  };

  if (!diagram.sequence?.frames?.length) return root;

  return {
    ...root,
    sequence: {
      activeFrameId: diagram.sequence.activeFrameId,
      frames: diagram.sequence.frames.slice(0, 8).map((f) => ({
        id: f.id,
        title: f.title,
        note: f.note,
        durationMs: f.durationMs,
        ...compactLayers(f),
      })),
    },
  };
}

const BOARD_AI_SEQUENCE_MAX_FRAMES = 8;

function layersFromRepaired(d: WebDiagramV1) {
  return {
    players: d.players || [],
    arrows: d.arrows || [],
    areas: d.areas || [],
    labels: d.labels || [],
    balls: d.balls,
    goals: d.goals,
    coach: d.coach,
    cones: d.cones,
  };
}

/** Repair root + every sequence frame, then enforce cross-frame focus + organization. */
export function repairBoardDiagramWithSequence(
  diagram: WebDiagramV1,
  message: string
): WebDiagramV1 {
  const repairOne = (d: WebDiagramV1) =>
    repairBoardDiagramOppositionNearPlay(
      repairBoardDiagramFocusZone(
        repairBoardDiagramLabels(
          repairBoardDiagramArrows(
            repairBoardDiagramOrientation(repairBoardDiagramPlayerCleanup(d))
          )
        ),
        message
      ),
      message
    );

  let working: WebDiagramV1 = diagram;
  if (!working.sequence?.frames?.length && isPlayOutRequest(message, diagram)) {
    working = applyPlayOutSequenceToDiagram(repairOne(diagram), message);
  }

  const seq = working.sequence;
  if (!seq?.frames?.length) {
    return repairOne(working);
  }

  let frames = seq.frames.slice(0, BOARD_AI_SEQUENCE_MAX_FRAMES).map((f, i) => {
    const asRoot: WebDiagramV1 = {
      pitch: working.pitch,
      players: f.players || [],
      arrows: f.arrows || [],
      areas: f.areas || [],
      labels: f.labels || [],
      balls: f.balls,
      goals: f.goals,
      coach: f.coach,
      cones: f.cones,
    };
    const repaired = repairOne(asRoot);
    const id = String(f.id || '').trim() || `f-${i + 1}`;
    return {
      id,
      title: f.title,
      note: f.note,
      durationMs: f.durationMs,
      ...layersFromRepaired(repaired),
    };
  });

  if (!frames.length) {
    return repairOne(working);
  }

  frames = repairBoardSequenceCoherence(frames, message) as typeof frames;

  // Play-out / build-from-back: enforce goal-kick → pocket → final-third model (final authority)
  if (isPlayOutRequest(message, working)) {
    const placed = applyPlayOutSequenceToDiagram(
      {
        ...working,
        sequence: {
          frames,
          activeFrameId:
            frames.find((f) => f.id === seq.activeFrameId)?.id || frames[0].id,
        },
      },
      message
    );
    if (placed.sequence?.frames?.length) {
      frames = placed.sequence.frames.map((f) => {
        const cleaned = repairBoardDiagramLabels(
          repairBoardDiagramArrows({
            pitch: working.pitch,
            players: f.players,
            arrows: f.arrows,
            areas: f.areas,
            labels: f.labels,
            balls: f.balls,
          })
        );
        return {
          id: f.id,
          title: f.title,
          note: f.note,
          durationMs: f.durationMs,
          ...layersFromRepaired(cleaned),
        };
      }) as typeof frames;
    }
  }

  const activeFrameId =
    frames.find((f) => f.id === seq.activeFrameId)?.id || frames[0].id;
  const active = frames.find((f) => f.id === activeFrameId) || frames[0];

  return {
    ...working,
    ...layersFromRepaired({
      pitch: working.pitch,
      players: active.players,
      arrows: active.arrows,
      areas: active.areas,
      labels: active.labels,
      balls: active.balls,
      goals: active.goals,
      coach: active.coach,
      cones: active.cones,
    } as WebDiagramV1),
    sequence: { frames, activeFrameId },
  };
}

type SeqFrame = NonNullable<WebDiagramV1['sequence']>['frames'][number];

const SEQ_MIN_PLAYER_GAP = 7;
const SEQ_STRUCTURE_MAX_DRIFT = 18;
const SEQ_ACTIVE_NEAR_BALL = 22;

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function mainArea(areas: WebDiagramV1['areas'] | undefined) {
  const list = areas || [];
  const sizable = list.find(
    (a) => typeof a.y === 'number' && (a.width ?? 0) * (a.height ?? 0) >= 40
  );
  return sizable || list.find((a) => typeof a.y === 'number') || null;
}

/** Keep roster/spacing coherent while allowing the play to ADVANCE across frames. */
export function repairBoardSequenceCoherence(
  frames: SeqFrame[],
  message: string
): SeqFrame[] {
  if (frames.length < 2) {
    return frames.map((f) => ({
      ...f,
      players: separateOverlappingPlayers(f.players || []),
    }));
  }

  const base = frames[0];
  const basePlayers = base.players || [];
  const pitch = { variant: 'FULL' as const, orientation: 'HORIZONTAL' as const };
  const baseFocus = focusPointFromDiagram({
    pitch,
    players: basePlayers,
    arrows: base.arrows || [],
    areas: base.areas || [],
    labels: base.labels || [],
    balls: base.balls,
  });

  return frames.map((frame, idx) => {
    let players = mergePlayerRoster(basePlayers, frame.players || []);

    // Prefer this frame's own highlight — do NOT pin later slides to Frame 1's third
    // (build-up → pocket → transition must move up the pitch).
    let areas = frame.areas?.length
      ? [...frame.areas]
      : base.areas
        ? [...base.areas]
        : [];
    let balls = frame.balls ? frame.balls.map((b) => ({ ...b })) : undefined;
    let arrows = [...(frame.arrows || [])];
    let labels = [...(frame.labels || [])];

    if (idx > 0) {
      const advanced = advanceFrameFocus({
        idx,
        areas,
        balls,
        players,
        baseFocus,
      });
      areas = advanced.areas;
      balls = advanced.balls;
      players = advanced.players;

      const focusMain = mainArea(areas);
      const focusPoint =
        focusMain && typeof focusMain.x === 'number' && typeof focusMain.y === 'number'
          ? {
              x: focusMain.x + (focusMain.width ?? 10) / 2,
              y: focusMain.y + (focusMain.height ?? 10) / 2,
            }
          : balls?.[0] && typeof balls[0].x === 'number'
            ? { x: balls[0].x, y: balls[0].y }
            : null;
      players = softAnchorStructurePlayers(
        players,
        basePlayers,
        balls?.[0] || base.balls?.[0],
        focusPoint
      );

      const denser = enrichLaterFrameDensity({
        idx,
        players,
        arrows,
        areas,
        labels,
        balls,
        base,
        focusPoint,
      });
      players = denser.players;
      arrows = denser.arrows;
      areas = denser.areas;
      labels = denser.labels;
      balls = denser.balls;
    }
    players = separateOverlappingPlayers(players);

    const playFixed = repairBoardDiagramOppositionNearPlay(
      {
        pitch,
        players,
        arrows,
        areas,
        labels,
        balls,
      },
      message
    );
    players = separateOverlappingPlayers(playFixed.players || players);
    balls = playFixed.balls || balls;
    areas = playFixed.areas || areas;
    labels = playFixed.labels || labels;

    const labeled = repairBoardDiagramLabels({
      pitch,
      players,
      arrows,
      areas,
      labels,
      balls,
    });

    const arrowFixed = repairBoardDiagramArrows({
      pitch,
      players: labeled.players,
      arrows,
      areas: labeled.areas,
      labels: labeled.labels,
      balls: labeled.balls,
    });

    return {
      ...frame,
      players: arrowFixed.players,
      arrows: arrowFixed.arrows,
      areas: arrowFixed.areas,
      labels: arrowFixed.labels,
      balls: arrowFixed.balls,
    };
  });
}

/** Push later slides toward the DEF goal (lower y) when the model froze on Frame 1's pocket. */
function advanceFrameFocus(input: {
  idx: number;
  areas: WebDiagramV1['areas'];
  balls: WebDiagramV1['balls'] | undefined;
  players: WebDiagramV1['players'];
  baseFocus: { x: number; y: number } | null;
}): {
  areas: WebDiagramV1['areas'];
  balls: WebDiagramV1['balls'] | undefined;
  players: WebDiagramV1['players'];
} {
  const { idx, baseFocus } = input;
  let { areas, balls, players } = input;
  if (!baseFocus) return { areas, balls, players };

  const focus = focusPointFromDiagram({
    pitch: { variant: 'FULL', orientation: 'HORIZONTAL' },
    players,
    arrows: [],
    areas,
    labels: [],
    balls,
  });
  const stuck = !focus || dist(focus, baseFocus) < 12;
  if (!stuck) return { areas, balls, players };

  // ATT attacks toward DEF goal on the LEFT → decrease y each step
  const dy = -(10 + idx * 10);
  const shiftY = (y: number) => clamp01to100Local(y + dy);

  areas = (areas || []).map((a) =>
    typeof a.y === 'number' ? { ...a, y: shiftY(a.y) } : a
  );
  balls = balls?.map((b) =>
    typeof b.y === 'number' ? { ...b, x: b.x, y: shiftY(b.y) } : b
  );
  // Nudge non-GK field players with the phase so the pocket actually moves
  players = players.map((p) => {
    if (isGkPlayer(p)) return p;
    return { ...p, y: shiftY(p.y) };
  });
  return { areas, balls, players };
}

function arrowEndpointId(ref: { playerId?: string } | undefined) {
  return ref?.playerId || '';
}

function arrowSignature(a: WebDiagramV1['arrows'][number]) {
  return `${arrowEndpointId(a.from)}>${arrowEndpointId(a.to)}:${a.type || 'pass'}`;
}

/**
 * Frame 2+ often arrives thin (1 arrow, Frame-1 caption). Densify with pass/run/press
 * involving nearby shirts and ensure captions narrate THIS step.
 */
function enrichLaterFrameDensity(input: {
  idx: number;
  players: WebDiagramV1['players'];
  arrows: WebDiagramV1['arrows'];
  areas: WebDiagramV1['areas'];
  labels: WebDiagramV1['labels'];
  balls: WebDiagramV1['balls'] | undefined;
  base: SeqFrame;
  focusPoint: { x: number; y: number } | null;
}): {
  players: WebDiagramV1['players'];
  arrows: WebDiagramV1['arrows'];
  areas: WebDiagramV1['areas'];
  labels: WebDiagramV1['labels'];
  balls: WebDiagramV1['balls'] | undefined;
} {
  let { players, arrows, areas, labels, balls } = input;
  const focus =
    input.focusPoint ||
    focusPointFromDiagram({
      pitch: { variant: 'FULL', orientation: 'HORIZONTAL' },
      players,
      arrows,
      areas,
      labels,
      balls,
    });
  if (!focus) return { players, arrows, areas, labels, balls };

  const NEAR = 26;
  const MIN_NEAR = 7;
  const MIN_ARROWS = input.idx === 1 ? 6 : 5;

  // Pull extra ATT + DEF into the pocket so 6–10 shirts are in the picture
  const field = players.filter((p) => !isGkPlayer(p));
  let nearCount = field.filter((p) => dist(p, focus) <= NEAR).length;
  if (nearCount < MIN_NEAR) {
    const need = MIN_NEAR - nearCount;
    const far = [...field]
      .filter((p) => dist(p, focus) > NEAR)
      .sort((a, b) => dist(a, focus) - dist(b, focus))
      .slice(0, need);
    const targets = new Map(
      far.map((p, i) => {
        const side = p.team === 'DEF' ? -1 : 1;
        return [
          p.id,
          {
            x: clamp01to100Local(focus.x + (i - (far.length - 1) / 2) * 9),
            y: clamp01to100Local(focus.y + side * (8 + (i % 2) * 4)),
          },
        ] as const;
      })
    );
    players = players.map((p) => {
      const t = targets.get(p.id);
      if (!t) return p;
      return {
        ...p,
        x: clamp01to100Local(p.x * 0.25 + t.x * 0.75),
        y: clamp01to100Local(p.y * 0.25 + t.y * 0.75),
      };
    });
    nearCount = players.filter((p) => !isGkPlayer(p) && dist(p, focus) <= NEAR).length;
  }

  const nearPlayers = [...players]
    .filter((p) => !isGkPlayer(p) && dist(p, focus) <= NEAR + 4)
    .sort((a, b) => dist(a, focus) - dist(b, focus));
  const attNear = nearPlayers.filter((p) => p.team === 'ATT');
  const defNear = nearPlayers.filter((p) => p.team === 'DEF');

  const existing = new Set(arrows.map(arrowSignature));
  const pushArrow = (
    fromId: string,
    toId: string,
    type: 'pass' | 'run' | 'press' | 'cover',
    style: 'solid' | 'dashed' = 'solid'
  ) => {
    if (!fromId || !toId || fromId === toId) return;
    const sig = `${fromId}>${toId}:${type}`;
    if (existing.has(sig)) return;
    existing.add(sig);
    arrows.push({
      from: { playerId: fromId },
      to: { playerId: toId },
      type,
      style,
      weight: type === 'pass' ? 'bold' : 'normal',
      arrowhead: true,
    });
  };

  // Drop exact Frame-1 arrow clones when this slide barely changed
  const baseSigs = new Set((input.base.arrows || []).map(arrowSignature));
  const uniqueVsBase = arrows.filter((a) => !baseSigs.has(arrowSignature(a))).length;
  if (arrows.length >= 2 && uniqueVsBase === 0 && attNear.length >= 2) {
    arrows = [];
    existing.clear();
  }

  if (arrows.length < MIN_ARROWS && attNear.length >= 2) {
    // Primary pass between closest ATT pair
    pushArrow(attNear[0].id, attNear[1].id, 'pass', 'solid');
    if (attNear[2]) pushArrow(attNear[1].id, attNear[2].id, 'pass', 'solid');
    // Support / half-space runs
    if (attNear[3]) pushArrow(attNear[3].id, attNear[1].id, 'run', 'dashed');
    if (attNear[4]) pushArrow(attNear[4].id, attNear[0].id, 'run', 'dashed');
    // DEF press + cover
    if (defNear[0] && attNear[0]) pushArrow(defNear[0].id, attNear[0].id, 'press', 'solid');
    if (defNear[1] && defNear[0]) pushArrow(defNear[1].id, defNear[0].id, 'cover', 'dashed');
    if (defNear[2] && attNear[1]) pushArrow(defNear[2].id, attNear[1].id, 'press', 'dashed');
    if (attNear[5] && attNear[2]) pushArrow(attNear[5].id, attNear[2].id, 'run', 'dashed');
  }

  // Ensure a highlight exists on this step
  if (!areas.length && input.base.areas?.length) {
    const src = input.base.areas[0];
    areas = [
      {
        ...src,
        x: clamp01to100Local(focus.x - (src.width ?? 18) / 2),
        y: clamp01to100Local(focus.y - (src.height ?? 14) / 2),
      },
    ];
  }

  const baseLabelTexts = new Set(
    (input.base.labels || []).map((l) => String(l.text || '').trim().toLowerCase())
  );
  const labelsUnique = labels.filter(
    (l) => !baseLabelTexts.has(String(l.text || '').trim().toLowerCase())
  );
  if (labelsUnique.length < 2) {
    const a0 = attNear[0]?.number;
    const a1 = attNear[1]?.number;
    const a2 = attNear[2]?.number;
    const d0 = defNear[0]?.number;
    const d1 = defNear[1]?.number;
    const mainAreaBox = mainArea(areas);
    const lx =
      mainAreaBox && typeof mainAreaBox.x === 'number'
        ? clamp01to100Local(mainAreaBox.x + (mainAreaBox.width ?? 10) + 4)
        : clamp01to100Local(focus.x + 14);
    const ly =
      mainAreaBox && typeof mainAreaBox.y === 'number'
        ? clamp01to100Local(mainAreaBox.y + (mainAreaBox.height ?? 10) / 2)
        : clamp01to100Local(focus.y - 8);
    const caption1 =
      a0 != null && a1 != null
        ? `ATT #${a0} finds #${a1} in the pocket; ${a2 != null ? `#${a2} offers the next angle` : 'support arrives late'}.`
        : 'ATT break the first line into the half-space pocket with an extra midfielder.';
    const caption2 =
      d0 != null
        ? `DEF #${d0}${d1 != null ? ` + #${d1}` : ''} jump the receiver while cover holds the inside lane.`
        : 'DEF’s nearest presser jumps; the cover shadow protects the centre.';
    labels = [
      { text: caption1.slice(0, 200), x: lx, y: ly },
      { text: caption2.slice(0, 200), x: lx, y: clamp01to100Local(ly + 10) },
    ];
  }

  if (!balls?.length) {
    balls = [{ x: focus.x, y: focus.y }];
  } else if (typeof balls[0].x === 'number') {
    balls = [
      {
        ...balls[0],
        x: clamp01to100Local(balls[0].x * 0.4 + focus.x * 0.6),
        y: clamp01to100Local(balls[0].y * 0.4 + focus.y * 0.6),
      },
      ...balls.slice(1),
    ];
  }

  return { players, arrows, areas, labels, balls };
}

function mergePlayerRoster(
  base: WebDiagramV1['players'],
  next: WebDiagramV1['players']
): WebDiagramV1['players'] {
  const byId = new Map(next.map((p) => [p.id, p]));
  const merged: WebDiagramV1['players'] = [];
  for (const bp of base) {
    const cur = byId.get(bp.id);
    if (cur) {
      merged.push({ ...bp, ...cur, id: bp.id, team: cur.team || bp.team, number: cur.number ?? bp.number });
      byId.delete(bp.id);
    } else {
      // Keep formation complete — later frames must not drop structure players
      merged.push({ ...bp });
    }
  }
  for (const leftover of byId.values()) merged.push(leftover);
  return merged;
}

/** Pull far-drifted “structure” players back toward frame 1; leave ball/focus-near actors freer. */
function softAnchorStructurePlayers(
  players: WebDiagramV1['players'],
  basePlayers: WebDiagramV1['players'],
  ball: { x: number; y: number } | undefined,
  focusPoint?: { x: number; y: number } | null
): WebDiagramV1['players'] {
  const baseById = new Map(basePlayers.map((p) => [p.id, p]));
  return players.map((p) => {
    const base = baseById.get(p.id);
    if (!base) return p;
    if (p.number === 1 || String(p.role || '').toUpperCase() === 'GK') {
      return { ...p, x: base.x, y: base.y };
    }
    // Never yank someone farther from the live focus (esp. DEF pressers stepped up)
    if (focusPoint && dist(p, focusPoint) + 4 < dist(base, focusPoint)) {
      return p;
    }
    const drift = dist(p, base);
    const nearBall = ball ? dist(p, ball) <= SEQ_ACTIVE_NEAR_BALL : false;
    const nearFocus = focusPoint ? dist(p, focusPoint) <= SEQ_ACTIVE_NEAR_BALL + 4 : false;
    const active = nearBall || nearFocus || p.team === 'DEF';
    if (active) {
      // Active / DEF: still cap extreme teleporting, but allow press-line steps
      if (drift <= SEQ_STRUCTURE_MAX_DRIFT * 2.8) return p;
      const t = (SEQ_STRUCTURE_MAX_DRIFT * 2.8) / drift;
      return {
        ...p,
        x: clamp01to100Local(base.x + (p.x - base.x) * t),
        y: clamp01to100Local(base.y + (p.y - base.y) * t),
      };
    }
    if (drift <= SEQ_STRUCTURE_MAX_DRIFT) return p;
    const t = SEQ_STRUCTURE_MAX_DRIFT / drift;
    return {
      ...p,
      x: clamp01to100Local(base.x + (p.x - base.x) * t),
      y: clamp01to100Local(base.y + (p.y - base.y) * t),
    };
  });
}

function separateOverlappingPlayers(
  players: WebDiagramV1['players']
): WebDiagramV1['players'] {
  const next = players.map((p) => ({ ...p }));
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < next.length; i++) {
      for (let j = i + 1; j < next.length; j++) {
        const a = next[i];
        const b = next[j];
        const d = dist(a, b);
        if (d >= SEQ_MIN_PLAYER_GAP || d < 0.01) {
          if (d < 0.01) {
            // Identical coords — push along a stable axis by team/number
            const push = SEQ_MIN_PLAYER_GAP / 2;
            next[j] = {
              ...b,
              x: clamp01to100Local(b.x + push),
              y: clamp01to100Local(b.y + (b.team === a.team ? push : -push)),
            };
          }
          continue;
        }
        const ux = (b.x - a.x) / d;
        const uy = (b.y - a.y) / d;
        const need = (SEQ_MIN_PLAYER_GAP - d) / 2;
        next[i] = {
          ...a,
          x: clamp01to100Local(a.x - ux * need),
          y: clamp01to100Local(a.y - uy * need),
        };
        next[j] = {
          ...b,
          x: clamp01to100Local(b.x + ux * need),
          y: clamp01to100Local(b.y + uy * need),
        };
      }
    }
  }
  return next;
}

function wantsSequenceFromMessage(message: string): boolean {
  return /\b(sequence|sequences|multi[- ]?step|frame by frame|frames?|step by step|steps|progression|then |next (?:phase|moment|step)|animate|playback|play it out|show (?:the )?play develop|phases? of (?:the )?play|variances?|variants?)\b/i.test(
    message
  );
}

function snapshotBoardLayers(
  diagram: Pick<
    WebDiagramV1,
    'players' | 'arrows' | 'areas' | 'labels' | 'balls' | 'goals' | 'coach' | 'cones'
  >
) {
  return {
    players: diagram.players || [],
    arrows: diagram.arrows || [],
    areas: diagram.areas || [],
    labels: diagram.labels || [],
    balls: diagram.balls,
    goals: diagram.goals,
    coach: diagram.coach,
    cones: diagram.cones,
  };
}

function playerSetupSignature(players: WebDiagramV1['players'] | undefined): string {
  return (players || [])
    .map((p) => `${p.id}:${Math.round(p.x)}:${Math.round(p.y)}:${p.team}`)
    .sort()
    .join('|');
}

function renumberFrameTitle(title: string | undefined, n: number): string {
  const cleaned = String(title || '')
    .trim()
    .replace(/^\d+\.\s*/, '');
  if (!cleaned) return `${n}. Step`;
  return `${n}. ${cleaned}`;
}

/**
 * Frame 1 = exact pre-AI board (saved start). Frames 2+ = teaching additions.
 * Deterministic so the coach never loses the original positions.
 */
export function ensureSequenceStartsFromOriginal(
  result: WebDiagramV1,
  original: WebDiagramV1,
  message: string
): WebDiagramV1 {
  const aiFrames = result.sequence?.frames || [];
  const wantsSeq =
    wantsSequenceFromMessage(message) ||
    isPlayOutRequest(message, original) ||
    aiFrames.length >= 2;

  if (!wantsSeq) return result;

  const startLayers = snapshotBoardLayers(original);
  const startFrame: SeqFrame = {
    id: 'f-start',
    title: '1. Start (board)',
    note: 'Saved starting picture — original positions before the teaching sequence.',
    durationMs: 1600,
    ...startLayers,
  };

  let teaching: SeqFrame[];
  if (aiFrames.length === 0) {
    teaching = [
      {
        id: 'f-2',
        title: '2. Play',
        durationMs: 1600,
        ...snapshotBoardLayers(result),
      },
    ];
  } else if (
    !isPlayOutRequest(message, original) &&
    playerSetupSignature(aiFrames[0].players) === playerSetupSignature(startFrame.players) &&
    (aiFrames[0].arrows?.length || 0) === 0
  ) {
    // Model already mirrored the board as F1 with no teaching marks — replace with exact snapshot, keep later frames
    teaching = aiFrames.slice(1);
  } else if (
    playerSetupSignature(aiFrames[0].players) === playerSetupSignature(startFrame.players)
  ) {
    // Same setup but F1 already has teaching arrows — keep those as first teaching beat after start
    teaching = aiFrames;
  } else {
    teaching = aiFrames;
  }

  const rest = teaching.map((f, i) => ({
    ...f,
    id: f.id && f.id !== 'f-start' ? f.id : `f-${i + 2}`,
    title: renumberFrameTitle(f.title, i + 2),
  }));

  const frames = [startFrame, ...rest].slice(0, BOARD_AI_SEQUENCE_MAX_FRAMES);
  // Show the first teaching beat so the coach sees what was added; F1 keeps the original.
  const active = frames[Math.min(1, frames.length - 1)] || frames[0];

  return {
    ...result,
    ...snapshotBoardLayers(active),
    pitch: result.pitch || original.pitch,
    sequence: {
      frames,
      activeFrameId: active.id,
    },
  };
}

function resolvePlayer(
  players: WebDiagramV1['players'],
  ref: { playerId?: string; x?: number; y?: number } | undefined,
  hintTeam?: 'ATT' | 'DEF'
): { playerId?: string; x?: number; y?: number } | null {
  if (!ref) return null;
  if (ref.playerId) {
    const exact = players.find((p) => p.id === ref.playerId);
    if (exact) return { playerId: exact.id };

    // Try "att-3" / "def-7" / "3" / "LB" style ids
    const raw = String(ref.playerId).trim();
    const numMatch = raw.match(/(\d{1,2})$/);
    const num = numMatch ? Number(numMatch[1]) : NaN;
    const teamHint =
      /att|home|attack/i.test(raw) ? 'ATT' : /def|away/i.test(raw) ? 'DEF' : hintTeam;

    if (Number.isFinite(num)) {
      const byNum = players.find(
        (p) => p.number === num && (!teamHint || p.team === teamHint)
      ) || players.find((p) => p.number === num);
      if (byNum) return { playerId: byNum.id };
    }

    const role = raw.replace(/^(att|def|home|away)[-_]?/i, '').toUpperCase();
    const byRole = players.find(
      (p) =>
        String(p.role || '').toUpperCase() === role && (!teamHint || p.team === teamHint)
    );
    if (byRole) return { playerId: byRole.id };
  }

  if (typeof ref.x === 'number' && typeof ref.y === 'number') {
    return { x: ref.x, y: ref.y };
  }
  return null;
}

/** Ensure arrows have resolvable endpoints so the editor can draw them. */
export function repairBoardDiagramArrows(diagram: WebDiagramV1): WebDiagramV1 {
  const players = diagram.players || [];
  const arrows = (diagram.arrows || [])
    .map((a) => {
      const from = resolvePlayer(players, a.from, 'ATT') || resolvePlayer(players, a.from, 'DEF');
      const to = resolvePlayer(players, a.to, 'ATT') || resolvePlayer(players, a.to, 'DEF');
      if (!from || !to) return null;

      // If still only free coords missing, bake player coords as free points
      const fromFixed =
        from.playerId || (typeof from.x === 'number' && typeof from.y === 'number')
          ? from
          : null;
      const toFixed =
        to.playerId || (typeof to.x === 'number' && typeof to.y === 'number') ? to : null;
      if (!fromFixed || !toFixed) return null;

      return {
        ...a,
        from: fromFixed,
        to: toFixed,
        type: a.type || 'pass',
        style: a.style || 'solid',
        weight: a.weight || 'normal',
        arrowhead: typeof a.arrowhead === 'boolean' ? a.arrowhead : true,
      };
    })
    .filter(Boolean) as WebDiagramV1['arrows'];

  return { ...diagram, arrows };
}

function clamp01to100Local(n: number) {
  return Math.max(0, Math.min(100, n));
}

/**
 * Detect when the model drew attack along diagram-x (vertical on a HORIZONTAL pitch)
 * and remap to goal-to-goal on diagram-y.
 * Symptom: GKs separated mostly on x near midfield y, instead of on y near midfield x.
 */
export function isBoardOrientationSwapped(diagram: WebDiagramV1): boolean {
  const players = diagram.players || [];
  const attGk = players.find(
    (p) =>
      p.team === 'ATT' && (p.number === 1 || String(p.role || '').toUpperCase() === 'GK')
  );
  const defGk = players.find(
    (p) =>
      p.team === 'DEF' && (p.number === 1 || String(p.role || '').toUpperCase() === 'GK')
  );
  if (!attGk || !defGk) {
    // Fallback: ATT centroid should be higher y than DEF
    const att = players.filter((p) => p.team === 'ATT');
    const def = players.filter((p) => p.team === 'DEF');
    if (att.length < 3 || def.length < 3) return false;
    const avg = (list: typeof players, key: 'x' | 'y') =>
      list.reduce((s, p) => s + p[key], 0) / list.length;
    const ax = avg(att, 'x');
    const ay = avg(att, 'y');
    const dx = avg(def, 'x');
    const dy = avg(def, 'y');
    return Math.abs(ax - dx) > Math.abs(ay - dy) + 15 && Math.abs(ax - dx) > 35;
  }
  const ySpan = Math.abs(attGk.y - defGk.y);
  const xSpan = Math.abs(attGk.x - defGk.x);
  // Swapped if keepers are far apart on x and not clearly split on y
  return xSpan > 40 && xSpan > ySpan + 12;
}

/** Map (x,y) from vertical-attack mistake → horizontal pitch coords. */
function remapSwappedPoint(p: { x: number; y: number }): { x: number; y: number } {
  return {
    x: clamp01to100Local(p.y),
    y: clamp01to100Local(100 - p.x),
  };
}

function remapSwappedRef(ref: { playerId?: string; x?: number; y?: number } | undefined) {
  if (!ref) return ref;
  if (ref.playerId && (typeof ref.x !== 'number' || typeof ref.y !== 'number')) return ref;
  if (typeof ref.x === 'number' && typeof ref.y === 'number') {
    const next = remapSwappedPoint({ x: ref.x, y: ref.y });
    return { ...ref, x: next.x, y: next.y };
  }
  return ref;
}

/** Fix diagrams where teams attack top↔bottom instead of left↔right. */
export function repairBoardDiagramOrientation(diagram: WebDiagramV1): WebDiagramV1 {
  if (!isBoardOrientationSwapped(diagram)) {
    return {
      ...diagram,
      pitch: {
        ...diagram.pitch,
        orientation: 'HORIZONTAL',
      },
    };
  }

  const players = (diagram.players || []).map((p) => {
    const next = remapSwappedPoint(p);
    return { ...p, x: next.x, y: next.y };
  });

  const balls = (diagram.balls || []).map((b: any) => {
    if (!b || typeof b.x !== 'number' || typeof b.y !== 'number') return b;
    return { ...b, ...remapSwappedPoint(b) };
  });

  const areas = (diagram.areas || []).map((a) => {
    if (typeof a.x !== 'number' || typeof a.y !== 'number') return a;
    const w = a.width ?? 10;
    const h = a.height ?? 10;
    // T(x,y)=(y,100-x); box (x,y,w,h) → (y, 100-x-w, h, w)
    return {
      ...a,
      x: clamp01to100Local(a.y),
      y: clamp01to100Local(100 - a.x - w),
      width: h,
      height: w,
    };
  });

  const labels = (diagram.labels || []).map((l) => ({
    ...l,
    ...remapSwappedPoint(l),
  }));

  const arrows = (diagram.arrows || []).map((a) => ({
    ...a,
    from: remapSwappedRef(a.from) || a.from,
    to: remapSwappedRef(a.to) || a.to,
    ...(a.control && typeof a.control.x === 'number' && typeof a.control.y === 'number'
      ? { control: remapSwappedPoint(a.control) }
      : {}),
    ...(a.path
      ? {
          path: a.path.map((pt) =>
            typeof pt.x === 'number' && typeof pt.y === 'number' ? remapSwappedPoint(pt) : pt
          ),
        }
      : {}),
  }));

  const goals = (diagram.goals || []).map((g) => ({
    ...g,
    ...remapSwappedPoint(g),
  }));

  const cones = (diagram.cones || []).map((c) => ({
    ...c,
    ...remapSwappedPoint(c),
  }));

  const coach =
    diagram.coach && typeof diagram.coach.x === 'number' && typeof diagram.coach.y === 'number'
      ? { ...diagram.coach, ...remapSwappedPoint(diagram.coach) }
      : diagram.coach;

  return {
    ...diagram,
    pitch: {
      ...diagram.pitch,
      orientation: 'HORIZONTAL',
    },
    players,
    balls,
    areas,
    labels,
    arrows,
    goals,
    cones,
    coach,
  };
}

function pointInArea(
  pos: { x: number; y: number },
  area: { x?: number; y?: number; width?: number; height?: number }
) {
  if (typeof area.x !== 'number' || typeof area.y !== 'number') return false;
  const w = area.width ?? 0;
  const h = area.height ?? 0;
  return pos.x >= area.x && pos.x <= area.x + w && pos.y >= area.y && pos.y <= area.y + h;
}

/** Move captions off the emphasis — park on the opposite half of the pitch. */
export function repairBoardDiagramLabels(diagram: WebDiagramV1): WebDiagramV1 {
  const areas = diagram.areas || [];
  if (!areas.length || !(diagram.labels || []).length) return diagram;

  const main = areas.reduce((best, a) => {
    if (typeof a.x !== 'number' || typeof a.y !== 'number') return best;
    const area = (a.width ?? 10) * (a.height ?? 10);
    if (!best) return a;
    const bestArea = (best.width ?? 10) * (best.height ?? 10);
    return area >= bestArea ? a : best;
  }, areas[0]);

  if (!main || typeof main.x !== 'number' || typeof main.y !== 'number') return diagram;

  const mainX = main.x;
  const mainY = main.y;
  const mainW = main.width ?? 10;
  const mainH = main.height ?? 10;

  const focusX =
    diagram.balls?.[0] && typeof diagram.balls[0].x === 'number'
      ? diagram.balls[0].x
      : mainX + mainW / 2;

  const toMove: number[] = [];
  (diagram.labels || []).forEach((label, i) => {
    const inside = pointInArea(label, { x: mainX, y: mainY, width: mainW, height: mainH });
    const cy = mainY + mainH / 2;
    const near =
      Math.abs(label.y - cy) < mainH * 0.75 &&
      Math.abs(label.x - (mainX + mainW / 2)) < mainW * 0.75;
    if (inside || near) toMove.push(i);
  });
  if (!toMove.length) {
    return {
      ...diagram,
      labels: (diagram.labels || []).map((label) => ({
        ...label,
        text: String(label.text || '').slice(0, 200),
      })),
    };
  }

  const stack = labelStackAwayFromEmphasis(
    { x: mainX, y: mainY, width: mainW, height: mainH },
    toMove.length,
    focusX
  );

  let stackI = 0;
  const labels = (diagram.labels || []).map((label, i) => {
    const text = String(label.text || '').slice(0, 200);
    if (!toMove.includes(i)) return { ...label, text };
    const pos = stack[stackI] || { x: 84, y: 76 };
    stackI += 1;
    return { ...label, text, x: pos.x, y: pos.y };
  });
  return { ...diagram, labels };
}

const OPPOSITION_NEAR_PLAY_R = 32;
/** First-line pressers to park on the edge of the highlight. */
const OPPOSITION_PRESS_COUNT = 4;
/** Midfield/cover line behind the press. */
const OPPOSITION_COVER_COUNT = 4;
/**
 * Non-GK DEF may not sit deeper than (focus.y - this) when ATT is on the ball.
 * Goal-kick / play-out default is a HIGH block — keep the gap tight.
 */
const OPPOSITION_MAX_BEHIND = 26;
/**
 * Absolute floor for outfield DEF during ATT build-up / goal-kick in our half.
 * ~60 keeps the back line in ATT half / high — not a conservative mid-block.
 */
const OPPOSITION_BUILDUP_Y_FLOOR = 60;

function focusPointFromDiagram(diagram: WebDiagramV1): { x: number; y: number } | null {
  const area = mainArea(diagram.areas);
  if (area && typeof area.x === 'number' && typeof area.y === 'number') {
    return {
      x: area.x + (area.width ?? 10) / 2,
      y: area.y + (area.height ?? 10) / 2,
    };
  }
  const ball = diagram.balls?.[0];
  if (ball && typeof ball.x === 'number' && typeof ball.y === 'number') {
    return { x: ball.x, y: ball.y };
  }
  // Fallback: ATT outfield centroid — better than leaving DEF parked deep
  const att = (diagram.players || []).filter((p) => p.team === 'ATT' && !isGkPlayer(p));
  if (att.length >= 3) {
    const x = att.reduce((s, p) => s + p.x, 0) / att.length;
    const y = att.reduce((s, p) => s + p.y, 0) / att.length;
    return { x, y };
  }
  return null;
}

function isGkPlayer(p: { number?: number; role?: string }) {
  return p.number === 1 || String(p.role || '').toUpperCase() === 'GK';
}

/**
 * Dedupe ghost players, coerce bad teams, keep one shirt per team number.
 * Stops “white + red + blue” piles from att-* / home-* / NEUTRAL duplicates.
 */
export function repairBoardDiagramPlayerCleanup(diagram: WebDiagramV1): WebDiagramV1 {
  const raw = diagram.players || [];
  if (!raw.length) return diagram;

  const score = (p: WebDiagramV1['players'][number]) => {
    let s = 0;
    if (/^(att|def)-/i.test(p.id)) s += 5;
    if (p.team === 'ATT' || p.team === 'DEF') s += 3;
    if (typeof p.number === 'number') s += 1;
    if (p.role) s += 1;
    return s;
  };

  const normalized = raw.map((p) => {
    let team = p.team;
    if (team !== 'ATT' && team !== 'DEF' && team !== 'NEUTRAL') {
      team = /def|away/i.test(p.id) ? 'DEF' : /att|home/i.test(p.id) ? 'ATT' : 'NEUTRAL';
    }
    // Infer NEUTRAL toward a side by pitch end when both teams already exist
    if (team === 'NEUTRAL') {
      team = p.y >= 50 ? 'ATT' : 'DEF';
    }
    return { ...p, team };
  });

  // Prefer canonical ids; drop weaker duplicates of same team+number
  const byKey = new Map<string, WebDiagramV1['players'][number]>();
  const noNumber: WebDiagramV1['players'] = [];
  for (const p of [...normalized].sort((a, b) => score(b) - score(a))) {
    if (typeof p.number !== 'number') {
      noNumber.push(p);
      continue;
    }
    const key = `${p.team}:${p.number}`;
    if (!byKey.has(key)) byKey.set(key, p);
  }

  // Also dedupe identical ids
  const byId = new Map<string, WebDiagramV1['players'][number]>();
  for (const p of [...byKey.values(), ...noNumber]) {
    if (!byId.has(p.id)) byId.set(p.id, p);
  }

  let players = [...byId.values()];
  // Hard cap sanity (22 outfield+GKs typical; allow a few extras)
  if (players.length > 26) {
    players = players
      .slice()
      .sort((a, b) => score(b) - score(a))
      .slice(0, 26);
  }

  return {
    ...diagram,
    players: separateOverlappingPlayers(players),
  };
}

/**
 * Keep opposition compact on the play:
 * 1) place a press line near the ball/highlight
 * 2) place a cover line behind it
 * 3) hard-step anyone still parked in their own half
 * Default play-out = HIGH (goal kick). Mid/low block only when the coach asks.
 */
export function repairBoardDiagramOppositionNearPlay(
  diagram: WebDiagramV1,
  message: string
): WebDiagramV1 {
  // Play-out chassis owns DEF shape (e.g. 4-2-3-1). A 4+4 flat press line is wrong.
  if (isPlayOutRequest(message, diagram)) return diagram;

  const focus = focusPointFromDiagram(diagram);
  if (!focus) return diagram;

  let players = [...(diagram.players || [])];
  const att = players.filter((p) => p.team === 'ATT' && !isGkPlayer(p));
  const def = players.filter((p) => p.team === 'DEF' && !isGkPlayer(p));
  if (att.length < 2 || def.length < 2) return diagram;

  const near = (list: typeof players) =>
    list.filter((p) => dist(p, focus) <= OPPOSITION_NEAR_PLAY_R).length;
  const attNear = near(att);
  const defNear = near(def);

  // ATT clearly on this slide → compact DEF toward the ball (build-up / pocket / progression)
  const attOnPlay = attNear >= 2 || (attNear >= 1 && focus.y >= 45) || focus.y >= 60;
  const defOnPlay = defNear >= 2 || (defNear >= 1 && focus.y <= 55);

  const block = inferDefBlockHeight(message);

  if (attOnPlay) {
    // High (default) / mid / low offsets from focus
    const pressOffset = block === 'low' ? 18 : block === 'mid' ? 12 : 8;
    const coverOffset = block === 'low' ? 30 : block === 'mid' ? 22 : 16;
    const behind = block === 'low' ? 42 : block === 'mid' ? 34 : OPPOSITION_MAX_BEHIND;
    const absoluteFloor =
      block === 'low' ? 28 : block === 'mid' ? 42 : OPPOSITION_BUILDUP_Y_FLOOR;

    const pressY = clamp01to100Local(focus.y - pressOffset);
    const coverY = clamp01to100Local(focus.y - coverOffset);
    const backFloor = clamp01to100Local(
      Math.max(focus.y - behind, focus.y >= 60 ? absoluteFloor : 0)
    );

    // Always rebuild press + cover lines — never leave DEF parked on their box (unless low-block ask)
    const ordered = [...def].sort((a, b) => dist(a, focus) - dist(b, focus));
    const pressers = ordered.slice(0, OPPOSITION_PRESS_COUNT);
    const covers = ordered.slice(
      OPPOSITION_PRESS_COUNT,
      OPPOSITION_PRESS_COUNT + OPPOSITION_COVER_COUNT
    );
    const targets = new Map<string, { x: number; y: number }>();

    const placeLine = (
      line: typeof pressers,
      y: number,
      spread: number
    ) => {
      const startX = focus.x - ((line.length - 1) * spread) / 2;
      line.forEach((p, i) => {
        targets.set(p.id, {
          x: clamp01to100Local(startX + i * spread),
          y: clamp01to100Local(y),
        });
      });
    };
    placeLine(pressers, pressY, 11);
    placeLine(covers, coverY, 13);

    players = players.map((p) => {
      const t = targets.get(p.id);
      if (!t) return p;
      return {
        ...p,
        x: clamp01to100Local(p.x * 0.08 + t.x * 0.92),
        y: clamp01to100Local(p.y * 0.08 + t.y * 0.92),
      };
    });

    // Hard floor: remaining DEF (back line) cannot sit deeper than the play allows
    players = players.map((p) => {
      if (p.team !== 'DEF' || isGkPlayer(p)) return p;
      if (p.y >= backFloor) return p;
      return {
        ...p,
        y: clamp01to100Local(p.y * 0.1 + backFloor * 0.9),
      };
    });
  } else if (defOnPlay) {
    const pressY = clamp01to100Local(focus.y + 10);
    const coverY = clamp01to100Local(focus.y + 20);
    const backFloor = clamp01to100Local(focus.y + OPPOSITION_MAX_BEHIND);
    const ordered = [...att].sort((a, b) => dist(a, focus) - dist(b, focus));
    const pressers = ordered.slice(0, OPPOSITION_PRESS_COUNT);
    const covers = ordered.slice(
      OPPOSITION_PRESS_COUNT,
      OPPOSITION_PRESS_COUNT + OPPOSITION_COVER_COUNT
    );
    const targets = new Map<string, { x: number; y: number }>();
    const placeLine = (line: typeof pressers, y: number, spread: number) => {
      const startX = focus.x - ((line.length - 1) * spread) / 2;
      line.forEach((p, i) => {
        targets.set(p.id, {
          x: clamp01to100Local(startX + i * spread),
          y: clamp01to100Local(y),
        });
      });
    };
    placeLine(pressers, pressY, 11);
    placeLine(covers, coverY, 13);
    players = players.map((p) => {
      const t = targets.get(p.id);
      if (!t) return p;
      return {
        ...p,
        x: clamp01to100Local(p.x * 0.08 + t.x * 0.92),
        y: clamp01to100Local(p.y * 0.08 + t.y * 0.92),
      };
    });
    players = players.map((p) => {
      if (p.team !== 'ATT' || isGkPlayer(p)) return p;
      if (p.y <= backFloor) return p;
      return { ...p, y: clamp01to100Local(p.y * 0.1 + backFloor * 0.9) };
    });
  } else {
    return diagram;
  }

  return { ...diagram, players: separateOverlappingPlayers(players) };
}

/** Geographic thirds on the board length axis (diagram y). ATT = home = “us”. */
const THIRD_BANDS = {
  left: { yMin: 2, yMax: 32, mid: 17 }, // DEF goal end
  middle: { yMin: 34, yMax: 66, mid: 50 },
  right: { yMin: 68, yMax: 98, mid: 83 }, // ATT goal end
} as const;

type ThirdKey = keyof typeof THIRD_BANDS;

/**
 * Map coach language → board third.
 * “Us” = ATT (home). Their defensive third = DEF’s own end = left (y≈0).
 */
export function inferFocusThirdFromMessage(message: string): {
  third: ThirdKey;
  label: string;
} | null {
  const m = String(message || '').toLowerCase();
  if (!m.trim()) return null;

  // Their / opponent defensive third OR final third (attacking into their end)
  if (
    /\b(their|opponent'?s?|opp(?:osition)?)\b[\s\S]{0,40}\bdefensive third\b/.test(m) ||
    /\bdefensive third\b[\s\S]{0,40}\b(their|opponent'?s?|opp(?:osition)?)\b/.test(m) ||
    /\bin their (?:defensive )?third\b/.test(m) ||
    /\b(?:in|into) the final third\b/.test(m) ||
    /\bour attacking third\b/.test(m) ||
    /\bin (?:our|the) attacking third\b/.test(m)
  ) {
    return {
      third: 'left',
      label: 'their defensive third / our attacking third (left, DEF goal end, y 0–33)',
    };
  }

  // Our defensive third
  if (
    /\b(our|own)\b[\s\S]{0,40}\bdefensive third\b/.test(m) ||
    /\bdefensive third\b[\s\S]{0,40}\b(our|own)\b/.test(m) ||
    /\bin our (?:defensive )?third\b/.test(m) ||
    /\btheir attacking third\b/.test(m)
  ) {
    return {
      third: 'right',
      label: 'our defensive third / their attacking third (right, ATT goal end, y 67–100)',
    };
  }

  if (/\b(?:middle|midfield) third\b|\bin (?:the )?midfield\b/.test(m)) {
    return { third: 'middle', label: 'middle third (y 33–67)' };
  }

  if (/\bin (?:their|the opposition(?:'s)?|opp(?:osition)?) half\b/.test(m)) {
    return { third: 'left', label: 'their half (left side, toward DEF goal)' };
  }

  if (/\bin (?:our|own) half\b/.test(m)) {
    return { third: 'right', label: 'our half (right side, toward ATT goal)' };
  }

  return null;
}

function areaCenterY(area: { y?: number; height?: number }): number | null {
  if (typeof area.y !== 'number') return null;
  return area.y + (area.height ?? 10) / 2;
}

function yInThird(y: number, third: ThirdKey): boolean {
  const b = THIRD_BANDS[third];
  return y >= b.yMin && y <= b.yMax;
}

/**
 * If the coach named a third/half, slide highlights (and related free points)
 * into that band when the model parked them in the wrong third.
 */
export function repairBoardDiagramFocusZone(
  diagram: WebDiagramV1,
  message: string
): WebDiagramV1 {
  const focus = inferFocusThirdFromMessage(message);
  if (!focus) return diagram;
  const band = THIRD_BANDS[focus.third];

  const areas = diagram.areas || [];
  if (!areas.length) return diagram;

  // Use the first sizable area as the “main” highlight to align
  const mainIdx = areas.findIndex(
    (a) => typeof a.y === 'number' && (a.width ?? 0) * (a.height ?? 0) >= 40
  );
  const idx = mainIdx >= 0 ? mainIdx : areas.findIndex((a) => typeof a.y === 'number');
  if (idx < 0) return diagram;

  const main = areas[idx];
  const cy = areaCenterY(main);
  if (cy == null || yInThird(cy, focus.third)) return diagram;

  const dy = band.mid - cy;

  const nextAreas = areas.map((a) => {
    if (typeof a.y !== 'number') return a;
    const height = a.height ?? 10;
    const nextY = clamp01to100Local(a.y + dy);
    // Keep height; clamp so box stays on pitch
    const maxY = clamp01to100Local(100 - height);
    return { ...a, y: Math.min(nextY, maxY) };
  });

  const nextLabels = (diagram.labels || []).map((l) => ({
    ...l,
    y: clamp01to100Local(l.y + dy),
  }));

  const nextBalls = (diagram.balls || []).map((b: any) =>
    b && typeof b === 'object' && typeof b.y === 'number'
      ? { ...b, y: clamp01to100Local(b.y + dy) }
      : b
  );

  // Nudge outfield players (not GK #1) by the same shift so the press cluster moves with the window
  const nextPlayers = (diagram.players || []).map((p) => {
    if (p.number === 1 || String(p.role || '').toUpperCase() === 'GK') return p;
    return { ...p, y: clamp01to100Local(p.y + dy) };
  });

  const shiftRef = (ref: { playerId?: string; x?: number; y?: number } | undefined) => {
    if (!ref || ref.playerId) return ref;
    if (typeof ref.y !== 'number') return ref;
    return { ...ref, y: clamp01to100Local(ref.y + dy) };
  };

  const nextArrows = (diagram.arrows || []).map((a) => ({
    ...a,
    from: shiftRef(a.from) || a.from,
    to: shiftRef(a.to) || a.to,
    ...(a.control && typeof a.control.y === 'number'
      ? { control: { ...a.control, y: clamp01to100Local(a.control.y + dy) } }
      : {}),
    ...(a.path
      ? {
          path: a.path.map((pt) => ({
            ...pt,
            y: clamp01to100Local(pt.y + dy),
          })),
        }
      : {}),
  }));

  return {
    ...diagram,
    areas: nextAreas,
    labels: nextLabels,
    balls: nextBalls,
    players: nextPlayers,
    arrows: nextArrows,
  };
}

async function resolveBoardPlayModelContext(input: {
  gameModelId?: string | null;
  clubId?: string | null;
}): Promise<BoardPlayModelContext> {
  const fallbackId = String(input.gameModelId || 'unknown');

  if (input.clubId) {
    const club = await getClubPhilosophy(input.clubId);
    if (club) {
      const gameModelId = club.gameModelId || fallbackId;
      if (philosophyHasContent(club.philosophy)) {
        return {
          gameModelId,
          clubName: club.clubName,
          source: 'club_philosophy',
          philosophy: club.philosophy,
        };
      }
      const template = await getGameModelTemplate(gameModelId);
      return {
        gameModelId,
        clubName: club.clubName,
        source: template ? 'game_model_template' : 'id_only',
        philosophy: template?.philosophy || null,
        summary: template?.summary || null,
      };
    }
  }

  if (fallbackId && fallbackId !== 'unknown') {
    const template = await getGameModelTemplate(fallbackId);
    if (template) {
      return {
        gameModelId: fallbackId,
        source: 'game_model_template',
        philosophy: template.philosophy,
        summary: template.summary,
      };
    }
    const philosophy = await getGameModelTemplatePhilosophy(fallbackId);
    if (philosophy) {
      return {
        gameModelId: fallbackId,
        source: 'game_model_template',
        philosophy,
      };
    }
  }

  return { gameModelId: fallbackId, source: 'id_only' };
}

function buildBoardPlayModelGuidance(ctx: BoardPlayModelContext): string {
  const lines = [
    'CLUB PLAY MODEL (MANDATORY GUARDRAIL):',
    `- Locked gameModelId=${ctx.gameModelId}. This is how the club wants to play.`,
    '- Your reply AND the diagram must reflect this model — formations, arrows, highlights, and caption language.',
    '- Prefer coaching language and patterns from the stages below over generic soccer advice.',
    '- If the coach asks for something that conflicts with this model, still help, but frame the board in this club’s way of playing and note the tension briefly in reply.',
    '- Do not invent a different club identity (e.g. do not teach pure possession chaos when the model is PRESSING).',
  ];

  if (ctx.clubName) {
    lines.push(`- Club: ${ctx.clubName}`);
  }
  if (ctx.summary) {
    lines.push(`- Model summary: ${ctx.summary}`);
  }

  const p = ctx.philosophy;
  if (p && philosophyHasContent(p)) {
    lines.push(
      ctx.source === 'club_philosophy'
        ? 'DOC-authored club philosophy stages:'
        : 'Game-model template stages (use as the club playbook):'
    );
    if (p.attackingOrganization) {
      lines.push('Stage 1 — Attacking Organization (in possession):', p.attackingOrganization);
    }
    if (p.defensiveTransition) {
      lines.push('Stage 2 — Defensive Transition (on ball loss):', p.defensiveTransition);
    }
    if (p.defensiveOrganization) {
      lines.push('Stage 3 — Defensive Organization (out of possession):', p.defensiveOrganization);
    }
    if (p.attackingTransition) {
      lines.push('Stage 4 — Attacking Transition (on ball regain):', p.attackingTransition);
    }
  } else {
    lines.push(
      `- No detailed philosophy text loaded; still bias shapes and coaching cues toward gameModelId=${ctx.gameModelId}.`
    );
  }

  return lines.join('\n');
}

function conversationBlob(message: string, history: BoardAiChatMessage[]): string {
  return [...history.map((h) => h.content), message].join('\n');
}

function isForceDrawRequest(message: string): boolean {
  return /\b(just draw|draw it|use defaults?|don'?t ask|do not ask|no questions|go ahead|apply (?:it|now)|skip clarif)\b/i.test(
    message
  );
}

/** Coach is asking about / continuing from the picture already on the board. */
export function isBoardReferencingRequest(message: string): boolean {
  return /\b(look(?:ing)? at (?:the )?board|on (?:the )?board|from (?:here|there|this)|current (?:setup|board|picture|shape|positions?)|as (?:shown|drawn|set up|set)|from this (?:position|setup|shape|picture)|move from there|starting from (?:here|this|the board)|based on (?:the |this )?board|using (?:the |this )?board|what(?:'s| is) on the board|read the board)\b/i.test(
    message
  );
}

export type BoardSetupReading = {
  usable: boolean;
  attFormation: FormationId11 | null;
  defFormation: FormationId11 | null;
  phase: string | null;
  focusThird: 'DEFENSIVE' | 'MIDDLE' | 'ATTACKING' | null;
  channel: 'LEFT' | 'CENTER' | 'RIGHT' | null;
  summary: string;
};

function roleBand(role: string | undefined): 'back' | 'mid' | 'front' | 'gk' {
  const r = String(role || '').toUpperCase();
  if (r === 'GK' || r === '1') return 'gk';
  if (/^(CB|RB|LB|RWB|LWB|SW|LCB|RCB)$/.test(r)) return 'back';
  if (/^(ST|CF|SS|RW|LW|RF|LF|RAM|LAM)$/.test(r)) return 'front';
  return 'mid';
}

function formationFromLineCounts(back: number, mid: number, front: number): FormationId11 | null {
  const key = `${back}-${mid}-${front}`;
  if (key === '4-3-3') return '4-3-3';
  if (key === '4-4-2') return '4-4-2';
  if (key === '4-2-3-1' || (back === 4 && mid === 5 && front === 1)) return '4-2-3-1';
  if (key === '3-5-2') return '3-5-2';
  // 4-2-3-1 often roles as 4 backs, 2 pivots + 3 AMs in mid, 1 ST — mid may be counted as 5
  if (back === 4 && front === 1 && mid >= 4) return '4-2-3-1';
  if (back === 4 && front === 3 && mid >= 2) return '4-3-3';
  if (back === 4 && front === 2 && mid >= 3) return '4-4-2';
  if (back === 3 && front === 2 && mid >= 4) return '3-5-2';
  return null;
}

function inferFormationForTeam(
  players: WebDiagramV1['players'],
  team: 'ATT' | 'DEF'
): FormationId11 | null {
  const side = (players || []).filter((p) => p.team === team);
  if (side.length < 5) return null;

  const roles = side.map((p) => String(p.role || '').toUpperCase());
  const has = (re: RegExp) => roles.some((r) => re.test(r));
  const count = (re: RegExp) => roles.filter((r) => re.test(r)).length;

  // Role signatures beat raw line counts (4231 AMs look like “front”)
  if (
    count(/^(CB|RB|LB)$/) >= 4 &&
    count(/^(CDM|DM)$/) >= 1 &&
    (has(/^CAM$/) || has(/^RAM$/) || has(/^LAM$/)) &&
    count(/^(ST|CF)$/) <= 1
  ) {
    return '4-2-3-1';
  }
  if (count(/^(CB)$/) >= 3 && count(/^(RWB|LWB|WB)$/) >= 1 && count(/^(ST|CF)$/) >= 2) {
    return '3-5-2';
  }
  if (count(/^(ST|CF)$/) >= 2 && count(/^(CM|CDM|DM|RM|LM)$/) >= 4) {
    return '4-4-2';
  }

  let back = 0;
  let mid = 0;
  let front = 0;
  for (const p of side) {
    if (p.number === 1) continue;
    const band = roleBand(p.role);
    if (band === 'gk') continue;
    // Treat RAM/LAM as mid band for 4231 counting
    if (/^(RAM|LAM|CAM|AM)$/.test(String(p.role || '').toUpperCase())) {
      mid += 1;
      continue;
    }
    if (band === 'back') back += 1;
    else if (band === 'front') front += 1;
    else mid += 1;
  }
  // Fallback: cluster by depth if roles are sparse
  if (back + mid + front < 6) {
    const outfield = side.filter((p) => p.number !== 1 && roleBand(p.role) !== 'gk');
    const sorted = outfield
      .slice()
      .sort((a, b) => (team === 'ATT' ? a.y - b.y : b.y - a.y)); // advanced first
    if (sorted.length >= 7) {
      const n = sorted.length;
      const fCount = Math.max(1, Math.round(n * 0.3));
      const bCount = Math.max(2, Math.round(n * 0.35));
      front = fCount;
      back = bCount;
      mid = n - front - back;
    }
  }
  return formationFromLineCounts(back, mid, front);
}

function thirdFromY(y: number): 'DEFENSIVE' | 'MIDDLE' | 'ATTACKING' {
  // ATT view: high y = our defensive third, low y = our attacking third
  if (y >= 67) return 'DEFENSIVE';
  if (y <= 33) return 'ATTACKING';
  return 'MIDDLE';
}

function channelFromX(x: number): 'LEFT' | 'CENTER' | 'RIGHT' {
  // ATT attacks left: high x = ATT left (top), low x = ATT right (bottom)
  if (x >= 62) return 'LEFT';
  if (x <= 38) return 'RIGHT';
  return 'CENTER';
}

function phaseFromBoardText(text: string): string | null {
  const t = text.toLowerCase();
  if (/blue attacking|att(?:acking)?\b.*\batt third|build[-\s]?up|play(?:ing)? out|in possession/.test(t)) {
    if (/att third|final third|their (?:box|defensive)/.test(t)) return 'Attacking Organization · final third';
    if (/middle|pocket|progress/.test(t)) return 'Attacking Organization · progression';
    if (/def third|build|play out|goal[-\s]?kick/.test(t)) return 'Attacking Organization · build-up';
    return 'Attacking Organization';
  }
  if (/red defending|defending|out of possession|defensive organization/.test(t)) {
    return 'Defensive Organization';
  }
  if (/transition|press after|counterpress|on the regain/.test(t)) {
    return 'Defensive Transition';
  }
  if (/\battacking\b/.test(t)) return 'Attacking Organization';
  if (/\bdefending\b/.test(t)) return 'Defensive Organization';
  return null;
}

/** Read formations / phase / focus from the live board so chat can ground on it. */
export function readBoardSetup(diagram: WebDiagramV1): BoardSetupReading {
  const players = diagram.players || [];
  const attOut = players.filter((p) => p.team === 'ATT' && p.number !== 1);
  const defOut = players.filter((p) => p.team === 'DEF' && p.number !== 1);
  const usable = attOut.length >= 4 && defOut.length >= 4;

  const attFormation = inferFormationForTeam(players, 'ATT');
  const defFormation = inferFormationForTeam(players, 'DEF');

  const labelText = (diagram.labels || []).map((l) => l.text || '').join(' · ');
  const areaText = (diagram.areas || []).map((a) => a.label || '').join(' · ');
  const phase =
    phaseFromBoardText(`${labelText} ${areaText}`) ||
    (usable
      ? (() => {
          const ball = diagram.balls?.[0];
          const y =
            ball && typeof ball.y === 'number'
              ? ball.y
              : diagram.areas?.[0] && typeof diagram.areas[0].y === 'number'
                ? diagram.areas[0].y + (diagram.areas[0].height || 0) / 2
                : null;
          if (y == null) return 'Attacking Organization (from board shape)';
          const third = thirdFromY(y);
          if (third === 'DEFENSIVE') return 'Attacking Organization · build-up';
          if (third === 'ATTACKING') return 'Attacking Organization · final third';
          return 'Attacking Organization · progression';
        })()
      : null);

  const focusY = (() => {
    const ball = diagram.balls?.[0];
    if (ball && typeof ball.y === 'number') return ball.y;
    const area = diagram.areas?.[0];
    if (area && typeof area.y === 'number') return area.y + (area.height || 0) / 2;
    if (attOut.length) {
      return attOut.reduce((s, p) => s + p.y, 0) / attOut.length;
    }
    return null;
  })();
  const focusX = (() => {
    const ball = diagram.balls?.[0];
    if (ball && typeof ball.x === 'number') return ball.x;
    const area = diagram.areas?.[0];
    if (area && typeof area.x === 'number') return area.x + (area.width || 0) / 2;
    return 50;
  })();

  const focusThird = focusY == null ? null : thirdFromY(focusY);
  const channel = focusY == null ? null : channelFromX(focusX);

  const ball = diagram.balls?.[0];
  const summaryParts = [
    usable
      ? `Board has ${attOut.length + 1} ATT + ${defOut.length + 1} DEF shirts.`
      : 'Board lineup is thin / incomplete.',
    attFormation || defFormation
      ? `Inferred formations: ATT ${attFormation || '?'} vs DEF ${defFormation || '?'}.`
      : 'Formations not confidently inferred from roles — keep shirts as drawn.',
    phase ? `Phase from board: ${phase}.` : null,
    focusThird
      ? `Focus in ${focusThird === 'DEFENSIVE' ? 'our defensive third (RIGHT)' : focusThird === 'ATTACKING' ? 'our attacking third (LEFT)' : 'middle third'}${channel ? ` · ${channel.toLowerCase()} channel` : ''}.`
      : null,
    ball && typeof ball.x === 'number' && typeof ball.y === 'number'
      ? `Ball @(${Math.round(ball.x)},${Math.round(ball.y)}).`
      : null,
    labelText ? `Caption: “${labelText.slice(0, 120)}”.` : null,
  ].filter(Boolean);

  return {
    usable,
    attFormation,
    defFormation,
    phase,
    focusThird,
    channel,
    summary: summaryParts.join(' '),
  };
}

/** Normalize compact shapes coaches type without hyphens: 433 → 4-3-3, 4231 → 4-2-3-1. */
function normalizeFormationSpellings(text: string): string {
  return String(text || '')
    .replace(/\b([1-5])\s*([0-5])\s*([0-5])\s*([0-5])\s*([0-5])\b/g, '$1-$2-$3-$4-$5')
    .replace(/\b([1-5])\s*([0-5])\s*([0-5])\s*([0-5])\b/g, '$1-$2-$3-$4')
    .replace(/\b([1-5])\s*([0-5])\s*([0-5])\b/g, '$1-$2-$3');
}

function hasFormationDetail(text: string): boolean {
  const normalized = normalizeFormationSpellings(text);
  // e.g. 2-3-1, 4-2-3-1, 433, "formation 3-2-1", "ATT 4-3-3"
  return (
    /\b\d-\d(?:-\d){1,3}\b/.test(normalized) ||
    /\bformations?\b[\s\S]{0,40}\b\d-\d/.test(normalized) ||
    /\b(?:att|def|home|away)\s+\d-\d(?:-\d){0,3}\b/i.test(normalized) ||
    /\b(?:vs|versus|v\.?|against)\b/i.test(text) &&
      /\b\d-\d(?:-\d){1,3}\b/.test(normalized)
  );
}

function hasChannelDetail(text: string): boolean {
  return (
    /\b(left|right)\s+(channel|side|half|wing|flank|half[-\s]?space)\b/i.test(text) ||
    /\b(wide|wing|flank|touchline|half[-\s]?space)\b/i.test(text) ||
    /\b(central|center|centre)\s+(channel|lane|corridor|area|zone)?\b/i.test(text) ||
    /\b(middle of the (?:pitch|field|park)|through the middle)\b/i.test(text) ||
    /\bon the (left|right|weak|strong) side\b/i.test(text)
  );
}

function hasPhaseDetail(text: string): boolean {
  return (
    /\b(attacking organization|defensive organization|defensive transition|attacking transition)\b/i.test(
      text
    ) ||
    /\b(in possession|out of possession|build[-\s]?up|build(?:ing)? out|play(?:ing)? out(?: the back)?|from the back|build from (?:the )?back|press after (?:a )?loss|after (?:ball )?loss|on (?:the )?regain|counterpress|rest defence|rest defense)\b/i.test(
      text
    ) ||
    /\bphase\b[\s\S]{0,30}\b(attack|defend|transition|possession)\b/i.test(text)
  );
}

export type ScenarioGaps = {
  missingFormation: boolean;
  missingChannel: boolean;
  missingPhase: boolean;
};

export function assessScenarioGaps(
  message: string,
  history: BoardAiChatMessage[] = [],
  diagram?: WebDiagramV1 | null
): ScenarioGaps {
  const blob = conversationBlob(message, history);
  const board = diagram ? readBoardSetup(diagram) : null;
  // Live board with both teams can supply formations + phase — don't re-ask.
  const boardUsable = Boolean(board?.usable);
  return {
    missingFormation: !hasFormationDetail(blob) && !boardUsable,
    missingChannel: !hasChannelDetail(blob) && !board?.channel,
    missingPhase: !hasPhaseDetail(blob) && !boardUsable,
  };
}

export function needsBoardClarification(
  message: string,
  history: BoardAiChatMessage[] = [],
  diagram?: WebDiagramV1 | null
): boolean {
  if (isForceDrawRequest(message)) return false;
  // Direct board ops / tiny edits don't need a full scenario brief
  if (
    /\b(clear (?:the )?board|reset (?:the )?board|remove (?:all )?arrows|delete (?:the )?label|undo)\b/i.test(
      message
    )
  ) {
    return false;
  }
  // Usable live board already encodes formations + phase/focus — read it instead of clarifying
  if (diagram && readBoardSetup(diagram).usable) {
    return false;
  }
  const gaps = assessScenarioGaps(message, history, diagram);
  // Formation + phase are required. Channel defaults to central when omitted
  // (coaches often say “433 vs 442 play out” without naming a lane).
  return gaps.missingFormation || gaps.missingPhase;
}

function buildClarifyingReply(input: {
  gaps: ScenarioGaps;
  gameModelId?: string | null;
  ageGroup?: string | null;
  clubName?: string | null;
}): string {
  const lines: string[] = [
    'That’s a bit open — I need a few details before I draw so it matches how the club wants to play.',
  ];
  if (input.clubName || input.gameModelId) {
    lines.push(
      `We’ll keep it inside ${input.clubName || 'your club'}’s ${String(input.gameModelId || 'game model').replace(/_/g, ' ')} model.`
    );
  }
  lines.push('');
  let n = 1;
  if (input.gaps.missingFormation) {
    lines.push(
      `${n}. Formations — e.g. ATT 4-3-3 vs DEF 4-4-2 (hyphens optional: 433 vs 442 is fine).`
    );
    n += 1;
  }
  if (input.gaps.missingPhase) {
    lines.push(
      `${n}. Phase — e.g. play out / build-up, press after loss, or Attacking Organization / Defensive Transition.`
    );
    n += 1;
  }
  if (input.ageGroup) {
    lines.push('');
    lines.push(`(Age group on this board: ${input.ageGroup}.)`);
  }
  lines.push('');
  lines.push('Reply with those and I’ll set the board. Or say “just draw it” to use sensible defaults.');
  return lines.join('\n');
}

function buildPlayOutMotifClarifyingReply(input: {
  diagram: WebDiagramV1;
  gameModelId?: string | null;
  clubName?: string | null;
  ageGroup?: string | null;
  philosophyBlurb?: string | null;
}): string {
  const board = readBoardSetup(input.diagram);
  const att = board.attFormation;
  const def = board.defFormation;
  const options = playOutMotifOptions(att);
  const club = input.clubName || 'the club';
  const model = String(input.gameModelId || 'game model').replace(/_/g, ' ');
  const shape =
    att || def
      ? `ATT ${att || '?'} vs DEF ${def || '?'}`
      : 'the shapes already on the board';
  const where = [
    board.phase,
    board.focusThird === 'DEFENSIVE'
      ? 'our defensive third'
      : board.focusThird === 'ATTACKING'
        ? 'our attacking third'
        : board.focusThird === 'MIDDLE'
          ? 'middle third'
          : null,
    board.channel ? `${board.channel.toLowerCase()} channel` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const lines: string[] = [
    `That’s a known ${club} build-out — I’ll lock it to the ${model} pattern before I draw, so the picture matches how you want to play.`,
    '',
    `Reading the board: ${shape}${where ? ` · ${where}` : ''}.`,
  ];
  if (input.philosophyBlurb) {
    lines.push('', `In possession this model wants: ${input.philosophyBlurb}`);
  }
  lines.push('', 'Pick the motif:');
  for (const opt of options) {
    lines.push(`${opt.id}. ${opt.title} — ${opt.detail}`);
  }
  lines.push('');
  lines.push(
    'Reply **1** (playbook default), **2**, or “just draw it”. I won’t freehand shirts until this is locked.'
  );
  if (input.ageGroup) {
    lines.push(`(Age group on this board: ${input.ageGroup}.)`);
  }
  return lines.join('\n');
}

function buildPrompt(input: {
  diagram: WebDiagramV1;
  message: string;
  history: BoardAiChatMessage[];
  ageGroup?: string | null;
  gameModelId?: string | null;
  playModelGuidance: string;
  languageGuidance: string;
  clarifyRequired: boolean;
  gaps: ScenarioGaps;
}): string {
  const historyBlock =
    input.history.length === 0
      ? '(none)'
      : input.history
          .slice(-8)
          .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
          .join('\n');

  const playerIndex = formatBothTeamsPlayerIndex(input.diagram);
  const sequenceTeamBrief = formatSequenceBothTeamsBrief(input.diagram);
  const boardReading = readBoardSetup(input.diagram);

  const focusHint = inferFocusThirdFromMessage(input.message);
  const formationPlaybookGuidance = buildFormationPlaybookGuidance(
    conversationBlob(input.message, input.history),
    { att: boardReading.attFormation, def: boardReading.defFormation }
  );

  const clarifyBlock = input.clarifyRequired
    ? [
        'CLARIFY-FIRST (MANDATORY THIS TURN):',
        '- The coach request is too vague to draw accurately.',
        `- Missing: ${[
          input.gaps.missingFormation ? 'formations (both teams)' : null,
          input.gaps.missingPhase ? 'phase of play' : null,
        ]
          .filter(Boolean)
          .join('; ')}.`,
        '- Set apply=false. Do NOT change the diagram.',
        '- In reply, ask ONLY for the missing items (formations and/or phase). Keep it short and coach-friendly.',
        '- Channel defaults to central — do not ask for it unless the coach’s idea depends on a specific wing.',
        '- Ground the ask in the club play model (e.g. which transition stage).',
        '- Write clarifying questions at the coachLevel vocabulary (D plain / C one concept / B+ systemic).',
        '- If the coach said “just draw it” / “use defaults”, then you may apply with sensible defaults.',
        '- If the CURRENT BOARD already shows both teams, do NOT re-ask formations/phase — read the board instead.',
      ].join('\n')
    : [
        'CLARITY CHECK:',
        '- Prefer reading the CURRENT BOARD for formations, phase, ball, and focus when the coach refers to it (“looking at the board”, “from there”, etc.).',
        '- Formations and phase may come from: this message, chat history, OR the live board setup below.',
        '- If channel/side is omitted, DEFAULT to the board channel when known, else central — do not ask.',
        '- Only set apply=false when formations or phase are still unclear AND the board does not already show a usable setup.',
        input.gaps.missingChannel
          ? '- Channel not stated → use board channel or CENTRAL for this draw.'
          : null,
        '- When those are present (message, history, or board), apply=true and draw.',
      ]
        .filter(Boolean)
        .join('\n');

  const boardReadingBlock = [
    'CURRENT BOARD READING (authoritative starting picture):',
    `- ${boardReading.summary}`,
    boardReading.attFormation
      ? `- ATT formation on board: ${boardReading.attFormation}`
      : '- ATT formation on board: (infer from PLAYER INDEX roles/positions)',
    boardReading.defFormation
      ? `- DEF formation on board: ${boardReading.defFormation}`
      : '- DEF formation on board: (infer from PLAYER INDEX roles/positions)',
    boardReading.phase ? `- Phase on board: ${boardReading.phase}` : null,
    boardReading.focusThird
      ? `- Focus third: ${boardReading.focusThird}${boardReading.channel ? ` · channel ${boardReading.channel}` : ''}`
      : null,
    '- When the coach says “looking at the board / from there / from here”, interpret their ask against THIS picture — do not ask them to restate formations or phase.',
    '- Keep the same roster ids unless they ask to change the lineup. Build teaching sequences that start from these positions.',
  ]
    .filter(Boolean)
    .join('\n');

  return [
    'You are Tactical Edge AI — a soccer coaching assistant that edits a tactical board diagram.',
    'The coach describes a scenario in natural language. You update the board diagram JSON to match.',
    'You coach through the club’s locked game model — answers and drawings must show how THIS club wants to play.',
    'Prefer asking a short clarifying question over guessing when the picture would be wrong — BUT never re-ask what is already visible on the board.',
    '',
    input.playModelGuidance,
    '',
    input.languageGuidance,
    '',
    formationPlaybookGuidance,
    '',
    clarifyBlock,
    '',
    boardReadingBlock,
    '',
    'COORDINATE SYSTEM (critical — do not invent a vertical pitch):',
    '- Pitch is ALWAYS HORIZONTAL on this board. Goals are LEFT and RIGHT on screen — never top/bottom.',
    '- Goal-to-goal axis = diagram y (0 = left / DEF goal, 100 = right / ATT goal).',
    '- Touchline / width axis = diagram x (0–100). On screen, high x = TOP touchline, low x = BOTTOM touchline.',
    '- DEF (away) own goal ≈ y 0–8, x ≈ 50. DEF attacks toward increasing y (left→right).',
    '- ATT (home) own goal ≈ y 92–100, x ≈ 50. ATT attacks toward decreasing y (right→left).',
    '- NEVER place GKs at top/bottom of the screen (that means you put attack on x). GKs must sit near the LEFT and RIGHT goals.',
    '- Example ATT 4-3-3 build-up: GK @(50,96), CBs @(38,88)&(62,88), fullbacks wide on x, #6 @(50,78) — all with HIGH y, varied x.',
    '- Example DEF shape opposite: GK @(50,4), line near LOW y, varied x.',
    '- Mirror lateral roles for DEF so right-sided players stay on that team’s right (bottom of screen when DEF faces right).',
    '',
    'PITCH THIRDS (critical — do not confuse with midfield):',
    '- “Us” on this board = ATT (home). “Them” = DEF (away).',
    '- Left third y 0–33 = DEF goal end = THEIR defensive third = OUR attacking / final third.',
    '- Middle third y 33–67 = midfield third. Only use when coach says midfield/middle third.',
    '- Right third y 67–100 = ATT goal end = OUR defensive third = THEIR attacking third.',
    '- If coach says “their defensive third” / “final third” / “our attacking third”: put the main highlight, ball, and press cluster in y 0–33 (LEFT), NOT midfield.',
    '- If coach says “our defensive third” / “our half” (defending): bias action to y 67–100 (RIGHT).',
    '- Area boxes for a named third must have their center y inside that third’s band.',
    '- Channel: left = high diagram x (top of screen), central = mid x, right = low diagram x (bottom of screen).',
    focusHint
      ? `- RESOLVED FROM THIS REQUEST: place the main action in ${focusHint.label}.`
      : '- If no third/half is named, keep the action where the coach’s scenario implies.',
    '',
    'ALLOWED FORMATIONS:',
    '- 7v7: 2-3-1, 3-2-1',
    '- 9v9: 3-2-3, 2-3-2-1, 3-3-2',
    '- 11v11: 4-3-3, 4-2-3-1, 4-4-2, 3-5-2 — use the CHASSIS & SPACING PLAYBOOK above for roles, spacing, and motif arrows.',
    '',
    'DIAGRAM RULES:',
    '- Return a FULL diagram object every time you apply changes (not a patch).',
    '- When apply=false, still return the CURRENT diagram unchanged.',
    '- Keep pitch.orientation = "HORIZONTAL".',
    '- players: team ATT|DEF only (avoid NEUTRAL). ids like att-9 / def-6. Never create duplicate shirts (one #5 ATT max).',
    '- Traditional numbers when possible: 1 GK, 2 RB, 3 LB, 4 RCB, 5 LCB, 6 CDM/holding, 7 RW/RM, 8/10 CM, 9 ST, 11 LW/LM.',
    '- Choose shapes, pressing arrows, support angles, and captions that express the club play model stages above.',
    '- Match diagram density and caption vocabulary to the COACH / PLAYER LANGUAGE LOCK.',
    '- ARROWS (required when coach asks for passes/runs/switches/press):',
    '  - from/to MUST be objects: {"playerId":"<exact id from PLAYER INDEX>"} OR {"x":n,"y":n}',
    '  - NEVER leave from/to empty. NEVER use role names alone as playerId unless that exact id exists.',
    '  - type: pass|run|press|cover|transition; style: solid|dashed|dotted; weight: normal|bold',
    '  - For a switch of play / pass, use type "pass", style "solid", arrowhead true.',
    '  - Example: {"from":{"playerId":"att-3"},"to":{"playerId":"att-7"},"type":"pass","style":"solid","weight":"normal","arrowhead":true}',
    '- Prefer linking arrows to playerIds from the PLAYER INDEX below (or ids you create in players).',
    '- areas: optional zones with shape rect|circle|spotlight.',
    '- labels: explanatory coaching captions that say WHAT the drawing shows (≤200 chars, finish the sentence).',
    '  Write action language with shirt numbers — not vague titles like “Counterpress Window”.',
    '  Good: “#3 presses the space; #6 gets on the 6’s back; nearest 2 hunt the ball.”',
    '  Good: “ATT #8 jumps the bounce; #4 covers inside; #9 locks the front.”',
    '  Bad: “Press”, “Transition”, “Counterpress Window”.',
    '  Prefer 1–2 short sentences that narrate the arrows/players on the pitch.',
    '  Place OUTSIDE highlights — never center text inside an area or on the player cluster.',
    '  Put captions on the OPPOSITE side of the emphasis along the pitch (goal→goal):',
    '  · Emphasis in LEFT / final third (low y) → labels in RIGHT half (y ≈ 72–88).',
    '  · Emphasis in RIGHT / build-up (high y) → labels in LEFT half (y ≈ 10–28).',
    '  · Also park off the active channel on x (opposite flank) so text isn’t on shirts.',
    '  Bad: x ≈ area.x + area.width next to the yellow box on top of players.',
    '  Always include at least one label when you draw presses/runs/passes so the picture is readable.',
    '- balls: 0–1 centre ball unless asked otherwise.',
    '- Max PER FRAME: 30 players, 40 arrows, 20 areas, 20 labels.',
    '',
    'SEQUENCE / MULTI-STEP (critical when teaching a play over time):',
    '- Create diagram.sequence when the coach asks for a sequence, steps, progression, “then…”, phases over time, frame-by-frame, variants, or to show how the play develops.',
    '- Also create a sequence when a single static picture would hide the order of actions (trigger → reaction → cover).',
    '- 2–5 teaching frames after the start; absolute max 8 total.',
    '- FRAME 1 MUST BE THE CURRENT BOARD UNCHANGED — same player x/y, ball, areas, labels, arrows as CURRENT DIAGRAM JSON (the saved starting photo).',
    '- Frames 2+ ADD the teaching play (new passes/runs/press, moved ball, advanced shapes). Do not overwrite Frame 1 positions.',
    '- Each frame is a FULL independent snapshot: its own players, balls, arrows, areas, AND labels.',
    '- Do NOT reuse one shared annotation layer — every teaching frame must carry the notations that belong to THAT moment only.',
    '  Example: Frame 1 = board as-is; Frame 2 = first pass pattern; Frame 3 = second variant / next beat.',
    '- Keep player ids STABLE across frames (same att-9 / def-6) and move x/y so playback can tween.',
    '- Root players/arrows/areas/labels/balls MUST equal the active frame (usually Frame 2 — first teaching beat).',
    '- sequence.activeFrameId = id of the first teaching frame (Frame 2) when creating a new sequence, so Frame 1 stays the saved start.',
    '- Frame fields: id (unique), title (short step name at coachLevel language), optional note, optional durationMs (1200–2000).',
    '- Density limits and language lock apply PER FRAME (not summed across the whole sequence).',
    '- Single-snapshot requests: omit sequence OR keep one frame that mirrors the root.',
    '- If editing an existing sequence, preserve frame ids when updating those steps; add/remove frames only as needed.',
    '',
    'SEQUENCE CONTINUITY (mandatory):',
    '- Frame 1 locks the coach’s board photo (formations, channel, player ids/positions) — never invent a different start.',
    '- The PLAY MUST ADVANCE across frames 2+ (do not freeze the highlight on Frame 1’s third).',
    '- Typical first teaching beat for build-out / “progress to midfield”: Frame 2 = split CBs + #6 drop vs the named press (still in OUR defensive third). Frame 3 = midfield pocket. Frame 4 = final third.',
    '- Do NOT jump Frame 2 straight to the centre circle when the coach asked how to progress FROM the current first-line picture.',
    '- Move the ball + highlight with the phase on teaching frames. Structure players shift gradually (≤ ~18 units from Frame 1) unless they are in the action.',
    '- Frames 2–N need MORE detail than Frame 1: involve 6–10 players in the picture (CBs, #6/#8, fullbacks/wing-backs, wingers, pressers).',
    '- Frame 2 is the first teaching beat — NEVER a thinner copy of Frame 1.',
    '  Density target: 6–8 arrows (pass + support runs + DEF press/cover), 2 captions, 1–2 zones.',
    '  Involve shirts from BOTH teams: e.g. ATT #4/#6/#8/#2/#3/#7 plus DEF #9/#10/#8/#6 in/around the pocket.',
    '  Captions must name the teaching action (pocket receive, third-man, press jump) — do not reuse a generic Frame 1 sentence.',
    '- Never stack players. Keep ≥5 units between shirt centers.',
    '- Labels narrate THAT frame’s action (complete sentences), parked outside the highlight.',
    '',
    'BOTH TEAMS ON EVERY SLIDE (critical — positions must fit the moment):',
    '- READ ATT and DEF positions before you draw. Never invent a slide from one team only.',
    '- Every frame’s players[] MUST include the full ATT roster AND the full DEF roster (same ids as Frame 1).',
    '- For each frame, place BOTH teams relative to THAT slide’s action:',
    '  · Who has the ball? Who is pressing / covering / dropping / supporting on the OTHER team?',
    '  · Presser vs ball-carrier should be nearby (duel). Cover sits behind the press. Rest defence holds the opposite side.',
    '  · If ATT advances, DEF compresses toward the ball; if DEF wins/clears, ATT’s counter shape appears — still both teams on the board.',
    '- Arrows and captions should involve shirts from the team(s) actually acting on that slide; still keep the other team’s shape visible and relevant.',
    '- Do not leave a team parked in a meaningless block far from the focus while the slide is about a duel in the highlight.',
    '- Use the BOTH-TEAMS INDEX / FRAME POSITIONS below as spatial ground truth when editing.',
    '',
    'PHASE ↔ WHERE BOTH TEAMS STAND (mandatory):',
    '- ATT build-up / first line in our half (highlight near RIGHT goal, y≈70–98): DEF’s front press (ST + high mids/wingers) MUST be next to that highlight — typically 3–4 DEF within ~20 of the ball. Never leave all of DEF deep on the LEFT while ATT builds on the RIGHT.',
    '- DEFAULT play-out = goal kick: GK starts with the ball. DEF’s WHOLE outfield block is HIGH — as high as the ATT box.',
    '  Press on the box edge; cover ~8–12 behind; back line still in ATT half (outfield DEF floor roughly y≥58–65). Only DEF GK stays deep.',
    '  Do NOT draw a conservative mid/low block unless the coach asks for mid-block or low-block.',
    '- Against a play-out / 442 press: DEF’s front two + nearest CMs stand ON the edge of the yellow build-up box; midfield + back four step up compact behind them.',
    '- Caption mentioning “front three” / “press” / “4v2” / “first line” requires those opponents physically in or on the edge of the yellow box.',
    '- Midfield progression / “pocket”: DEF midfield + back line must step up — no defenders left on their own box while the ball is central.',
    '- High press / counterpress in their defensive third (LEFT, y≈0–33): cluster BOTH teams there; do not park ATT back at y≈90.',
    '- Captions: complete short sentences (≤200 chars). Prefer 1–2 lines that fit fully — do not trail off mid-phrase.',
    '',
    'OUTPUT: ONLY a JSON object (no markdown prose outside JSON):',
    '{',
    '  "reply": "FULL coach-facing briefing (write this FIRST, complete before diagram): Slide 1/2/3 — who moves, which shirts, what advantage. 4–8 short sentences. Never truncate mid-thought.",',
    '  "apply": true|false,',
    '  "diagram": { ...full WebDiagramV1, optionally with sequence.frames[...]... }',
    '}',
    '',
    `Age group context: ${input.ageGroup || 'unknown'}`,
    `Game model id: ${input.gameModelId || 'unknown'}`,
    ...(wantsSequenceFromMessage(input.message)
      ? [
          'THIS REQUEST LIKELY WANTS A MULTI-FRAME SEQUENCE with independent notations on each frame.',
          'For every frame: read BOTH teams, then place them so the slide’s duel/press/cover makes spatial sense.',
          '',
        ]
      : ['']),
    'BOTH-TEAMS PLAYER INDEX (read ATT and DEF — use these ids in arrow from/to):',
    playerIndex || '(no players yet)',
    '',
    ...(sequenceTeamBrief
      ? ['FRAME POSITIONS — both teams per slide (spatial ground truth):', sequenceTeamBrief, '']
      : []),
    'RECENT CHAT:',
    historyBlock,
    '',
    'CURRENT DIAGRAM JSON:',
    JSON.stringify(compactDiagram(input.diagram)),
    '',
    'COACH REQUEST:',
    input.message,
  ].join('\n');
}

function formatPlayerLine(p: WebDiagramV1['players'][number]): string {
  return `${p.id} (#${p.number ?? '?'} ${p.role || p.team}) @(${Math.round(p.x)},${Math.round(p.y)})`;
}

function formatTeamBlock(
  label: string,
  players: WebDiagramV1['players'],
  team: 'ATT' | 'DEF'
): string {
  const rows = players
    .filter((p) => p.team === team)
    .slice()
    .sort((a, b) => (a.number ?? 99) - (b.number ?? 99))
    .map(formatPlayerLine);
  if (!rows.length) return `${label}: (none)`;
  return `${label}:\n${rows.map((r) => `  ${r}`).join('\n')}`;
}

/** Explicit ATT + DEF index so the model cannot ignore one side. */
function formatBothTeamsPlayerIndex(diagram: WebDiagramV1): string {
  const players = diagram.players || [];
  const att = formatTeamBlock('ATT (home / us)', players, 'ATT');
  const def = formatTeamBlock('DEF (away / them)', players, 'DEF');
  const other = players.filter((p) => p.team !== 'ATT' && p.team !== 'DEF');
  const neu =
    other.length > 0
      ? `OTHER:\n${other.map((p) => `  ${formatPlayerLine(p)}`).join('\n')}`
      : '';
  return [att, def, neu].filter(Boolean).join('\n');
}

/** Per-frame both-team positions for sequence continuity. */
function formatSequenceBothTeamsBrief(diagram: WebDiagramV1): string | null {
  const frames = diagram.sequence?.frames;
  if (!frames?.length) return null;
  return frames
    .slice(0, 8)
    .map((f, i) => {
      const players = f.players || [];
      const ball = f.balls?.[0];
      const ballStr =
        ball && typeof ball.x === 'number' && typeof ball.y === 'number'
          ? `ball @(${Math.round(ball.x)},${Math.round(ball.y)})`
          : 'ball (none)';
      const title = f.title?.trim() || `Frame ${i + 1}`;
      return [
        `[${i + 1}] ${title} (${f.id}) · ${ballStr}`,
        formatTeamBlock('  ATT', players, 'ATT'),
        formatTeamBlock('  DEF', players, 'DEF'),
      ].join('\n');
    })
    .join('\n');
}

export async function runBoardAiChat(input: {
  diagram: WebDiagramV1;
  message: string;
  history?: BoardAiChatMessage[];
  ageGroup?: string | null;
  gameModelId?: string | null;
  clubId?: string | null;
  coachLevel?: string | null;
  userId?: string | null;
}): Promise<BoardAiChatResult> {
  const audience = resolveBoardAudience({
    coachLevel: input.coachLevel,
    ageGroup: input.ageGroup,
  });
  const resultBase = {
    coachLevel: audience.coachLevel,
    playerLevel: audience.playerLevel,
  };

  const message = String(input.message || '').trim();
  if (!message) {
    return {
      ...resultBase,
      reply: 'Tell me what scenario you want on the board.',
      applied: false,
      diagram: input.diagram,
    };
  }
  if (message.length > 4000) {
    return {
      ...resultBase,
      reply: 'Keep the request under 4000 characters.',
      applied: false,
      diagram: input.diagram,
    };
  }

  const history = Array.isArray(input.history) ? input.history.slice(-8) : [];
  const gaps = assessScenarioGaps(message, history, input.diagram);
  const improveAsk = isSessionImproveRequest(message);
  const playOut =
    isPlayOutRequest(message, input.diagram) ||
    (hasPlayOutMotifLock(message, history) && assistantOfferedPlayOutMotif(history));
  const playOutClarify = needsPlayOutMotifClarification(message, history, input.diagram);
  // Training/vault asks don't need a fresh draw — use what's already on the board.
  const clarifyRequired = improveAsk
    ? false
    : playOutClarify
      ? false
      : needsBoardClarification(message, history, input.diagram);
  const playModel = await resolveBoardPlayModelContext({
    gameModelId: input.gameModelId,
    clubId: input.clubId,
  });
  const playModelGuidance = buildBoardPlayModelGuidance(playModel);
  const languageGuidance = buildBoardLanguageGuidance(audience);

  if (improveAsk) {
    const bridge = await runBoardSessionBridge({
      message,
      history,
      diagram: input.diagram,
      ageGroup: input.ageGroup,
      gameModelId: playModel.gameModelId || input.gameModelId,
      coachLevel: audience.coachLevel,
      playerLevel: audience.playerLevel,
      userId: input.userId,
    });
    return {
      ...resultBase,
      reply: bridge.reply,
      applied: false,
      diagram: input.diagram,
      sessionBridge: {
        params: bridge.params,
        recommendations: bridge.recommendations,
        generatorUrl: bridge.generatorUrl,
        generatorPrompt: bridge.generatorPrompt,
      },
    };
  }

  // Lock a known game-model motif before freehanding a build-out picture
  if (playOutClarify) {
    const blurb = playModel.philosophy?.attackingOrganization
      ? String(playModel.philosophy.attackingOrganization).replace(/\s+/g, ' ').trim().slice(0, 220)
      : null;
    return {
      ...resultBase,
      reply: buildPlayOutMotifClarifyingReply({
        diagram: input.diagram,
        gameModelId: playModel.gameModelId || input.gameModelId,
        clubName: playModel.clubName,
        ageGroup: input.ageGroup,
        philosophyBlurb: blurb,
      }),
      applied: false,
      diagram: input.diagram,
    };
  }

  // Deterministic clarify gate: don't burn a draw on a vague first ask
  if (clarifyRequired) {
    return {
      ...resultBase,
      reply: buildClarifyingReply({
        gaps,
        gameModelId: playModel.gameModelId || input.gameModelId,
        ageGroup: input.ageGroup,
        clubName: playModel.clubName,
      }),
      applied: false,
      diagram: input.diagram,
    };
  }

  const prompt = buildPrompt({
    diagram: input.diagram,
    message,
    history,
    ageGroup: input.ageGroup,
    gameModelId: playModel.gameModelId || input.gameModelId,
    playModelGuidance,
    languageGuidance,
    clarifyRequired: false,
    gaps,
  });

  setMetricsContext({
    operationType: 'board_ai_chat',
    ageGroup: input.ageGroup || undefined,
    gameModelId: playModel.gameModelId || input.gameModelId || undefined,
  });

  let text = '';
  try {
    text = await generateText(prompt, {
      timeout: 90000,
      retries: 1,
      model: process.env.GEMINI_BOARD_AI_MODEL || process.env.GEMINI_FAST_MODEL,
      // Multi-frame boards + full reply need headroom; default Gemini cap truncates mid-JSON.
      maxOutputTokens: 16384,
    });
  } finally {
    clearMetricsContext();
  }

  const parsed = parseJsonObject(text);

  const applyChassisFromSavedBoard = (replyText: string): BoardAiChatResult => {
    const board = readBoardSetup(input.diagram);
    const chassisAsk = isPlayOutRequest(message, input.diagram)
      ? message
      : `play out from the back ATT ${board.attFormation || '4-3-3'} vs DEF ${board.defFormation || '4-4-2'} ${board.channel || 'CENTER'} channel`;
    const placed = applyPlayOutSequenceToDiagram(input.diagram, chassisAsk);
    const sequenced = ensureSequenceStartsFromOriginal(placed, input.diagram, chassisAsk);
    const frameCount = sequenced.sequence?.frames?.length || 0;
    return {
      ...resultBase,
      reply:
        frameCount >= 3
          ? `${replyText}\n\nSequence: ${frameCount} frames — 1) Start (your board)  2) first-line shape (split CBs, #6 drop)  3+) midfield / final third. Chassis from the 11v11 playbook — not freehand coordinates.`
          : replyText,
      applied: true,
      diagram: sequenced,
    };
  };

  if (!parsed || typeof parsed !== 'object') {
    if (playOut) {
      return applyChassisFromSavedBoard(
        'Laid out the build-out sequence from your current board.'
      );
    }
    return {
      ...resultBase,
      reply: "I couldn't format a board update. Try a clearer scenario (e.g. “7v7 ATT 2-3-1 vs DEF 3-2-1, central channel, Defensive Transition — press after loss in their defensive third”).",
      applied: false,
      diagram: input.diagram,
    };
  }

  const reply =
    typeof parsed.reply === 'string' && parsed.reply.trim()
      ? parsed.reply.trim().slice(0, 6000)
      : 'Updated the board.';
  const apply = parsed.apply !== false;

  // Safety: never apply if gaps reappear (e.g. new vague turn after history reset)
  if (apply && !playOut && needsBoardClarification(message, history, input.diagram)) {
    return {
      ...resultBase,
      reply: buildClarifyingReply({
        gaps: assessScenarioGaps(message, history, input.diagram),
        gameModelId: playModel.gameModelId || input.gameModelId,
        ageGroup: input.ageGroup,
        clubName: playModel.clubName,
      }),
      applied: false,
      diagram: input.diagram,
    };
  }

  // Keep the model's coaching reply; draw shirts from the locked chassis + saved board.
  if (apply && playOut) {
    return applyChassisFromSavedBoard(reply);
  }

  if (!apply || !parsed.diagram) {
    return { ...resultBase, reply, applied: false, diagram: input.diagram };
  }

  const normalized = toWebDiagramV1(parsed.diagram);
  if (!normalized) {
    return {
      ...resultBase,
      reply: `${reply}\n\n(I drafted a change but the diagram was invalid — board left as-is.)`,
      applied: false,
      diagram: input.diagram,
    };
  }

  const validated = parseWebDiagramV1(normalized);
  if (!validated.ok) {
    return {
      ...resultBase,
      reply: `${reply}\n\n(I drafted a change but validation failed — board left as-is.)`,
      applied: false,
      diagram: input.diagram,
    };
  }

  const repaired = ensureSequenceStartsFromOriginal(
    repairBoardDiagramWithSequence(validated.diagram, message),
    input.diagram,
    message
  );
  const frameArrowCount = repaired.sequence?.frames?.length
    ? repaired.sequence.frames.reduce((n, f) => n + (f.arrows?.length || 0), 0)
    : repaired.arrows?.length || 0;
  const arrowCount = Math.max(repaired.arrows?.length || 0, frameArrowCount);
  const wantsLines = /\b(pass|run|switch|arrow|press|cross|ball to|from .+ to)\b/i.test(message);
  const replyWithArrowNote =
    wantsLines && arrowCount === 0
      ? `${reply}\n\n(I couldn't attach a draw-able arrow — try naming shirt numbers, e.g. “pass from ATT 3 to ATT 7”.)`
      : reply;

  const frameCount = repaired.sequence?.frames?.length || 0;
  const playOutApplied = isPlayOutRequest(message, input.diagram) && frameCount >= 3;
  const replyWithSequenceNote = playOutApplied
    ? `${replyWithArrowNote}\n\nSequence: ${frameCount} frames — 1) Start (your board)  2+) teaching steps. Chassis from the 11v11 playbook. Use Play / the filmstrip to scrub; Frame 1 keeps your original positions.`
    : wantsSequenceFromMessage(message) && frameCount < 2
      ? `${replyWithArrowNote}\n\n(I drew a single snapshot — ask again for “3 frames / step-by-step” if you want a sequence.)`
      : frameCount >= 2
        ? `${replyWithArrowNote}\n\nSequence: ${frameCount} frames — Frame 1 is your saved board; later frames add the play. Use Play on the board to scrub.`
        : replyWithArrowNote;

  return {
    ...resultBase,
    reply: replyWithSequenceNote,
    applied: true,
    diagram: repaired,
  };
}
