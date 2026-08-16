import { generateText, generateMultimodalText, setMetricsContext, clearMetricsContext } from '../gemini';
import { isBoardChatPdf, type BoardChatImage } from './board-ai-image';
import { parseWebDiagramV1 } from './board-diagram-schema';
import { toWebDiagramV1, type WebDiagramV1 } from './web-diagram-v1';
import {
  boardSymbolicDslEnabled,
  lockDslFormat,
  ensureDslEquipmentFromMessage,
  stripUnmentionedRondoMiniGoals,
  ensureRondoRosterFromMessage,
  ensureImportOverloadRoster,
  promoteRondoNeutralsFromMessage,
  inferGridIntentFromMessage,
  lockDslSeed,
  parseBoardSymbolicDsl,
  BOARD_GRID_INTENTS,
  type BoardSymbolicDsl,
} from './board-symbolic-dsl';
import {
  boardInvariantErrors,
  enforceBoardInvariants,
  separateOverlappingPlayers,
  solveBoardLayout,
  unstackDiagram,
} from './board-layout-solver';
import {
  getClubPhilosophy,
  philosophyHasContent,
  type ClubPhilosophyStages,
} from './club-philosophy';
import { getGameModelTemplate, getGameModelTemplatePhilosophy } from './game-model-templates';
import { applyPlayOutSequenceToDiagram, isPlayOutRequest, inferDefBlockHeight, labelStackAwayFromEmphasis } from './board-phase-placement';
import {
  buildFormationPlaybookGuidance,
  inferFormationsFromMessage,
  toFormationId11,
  type FormationId11,
} from './formation-principles';
import { summarizeBoardCardMeta } from './board-card-meta';
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
    elements?: WebDiagramV1['elements'];
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
    ...(d.elements && d.elements.length ? { elements: d.elements } : {}),
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
    elements: d.elements,
  };
}

/** Repair root + every sequence frame, then enforce cross-frame focus + organization. */
export function repairBoardDiagramWithSequence(
  diagram: WebDiagramV1,
  message: string
): WebDiagramV1 {
  const repairOne = (d: WebDiagramV1) => {
    const cleaned = repairBoardDiagramArrows(
      repairBoardDiagramOrientation(repairBoardDiagramPlayerCleanup(d))
    );
    const placed = looksLikeFunctionPractice(cleaned)
      ? repairImportPracticeLayout(cleaned)
      : repairBoardDiagramTeamEnds(
          repairBoardDiagramOppositionNearPlay(
            repairBoardDiagramFocusZone(cleaned, message),
            message
          )
        );
    return unstackDiagramPlayers(repairBoardDiagramLabels(placed));
  };

  let working: WebDiagramV1 = diagram;
  const freezePlayers = wantsFrozenPlayers(message);
  if (!working.sequence?.frames?.length && isPlayOutRequest(message) && !freezePlayers) {
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
      elements: f.elements,
    };
    const repaired = freezePlayers
      ? repairBoardDiagramLabels(
          repairBoardDiagramArrows({
            ...asRoot,
            players: asRoot.players,
          })
        )
      : repairOne(asRoot);
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

  frames = freezePlayers
    ? frames.map((f) => ({
        ...f,
        players: lockPlayersToRoster(f.players, frames[0]?.players || f.players),
      }))
    : (repairBoardSequenceCoherence(frames, message) as typeof frames);

  // Play-out / build-from-back: enforce goal-kick → pocket → final-third model (final authority)
  if (isPlayOutRequest(message) && !freezePlayers) {
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
        const cleaned = unstackDiagramPlayers(
          repairBoardDiagramLabels(
            repairBoardDiagramArrows({
              pitch: working.pitch,
              players: f.players,
              arrows: f.arrows,
              areas: f.areas,
              labels: f.labels,
              balls: f.balls,
            })
          )
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

  return unstackDiagramPlayers({
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
      elements: active.elements,
    } as WebDiagramV1),
    sequence: { frames, activeFrameId },
  });
}

type SeqFrame = NonNullable<WebDiagramV1['sequence']>['frames'][number];

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

function compactRosterForDsl(diagram: WebDiagramV1) {
  return {
    format: diagram.pitch?.format || '11V11',
    playerCount: (diagram.players || []).length,
    players: (diagram.players || []).map((p) => ({
      id: p.id,
      number: p.number,
      team: p.team,
      role: p.role,
    })),
  };
}

function diagramLooksLikeFunction(diagram?: WebDiagramV1 | null): boolean {
  if (!diagram) return false;
  const frames = diagram.sequence?.frames;
  const active =
    frames?.find((f) => f.id === diagram.sequence?.activeFrameId) || frames?.[frames.length - 1];
  const live = active
    ? {
        players: active.players?.length ? active.players : diagram.players,
        areas: active.areas?.length ? active.areas : diagram.areas,
        elements: active.elements?.length ? active.elements : diagram.elements,
      }
    : diagram;
  if ((live.elements || []).some((e) => e.kind === 'mini-goal')) return true;
  if ((live.areas || []).some((a) => /rondo|ssg/i.test(String(a.label || '')))) return true;
  const n = live.players?.length || 0;
  const format = diagram.pitch?.format || '11V11';
  const expected = format === '7V7' ? 14 : format === '9V9' ? 18 : 22;
  return n > 0 && n <= expected - 6;
}

function liveLooksLikeDefendingFunction(diagram?: WebDiagramV1 | null): boolean {
  const gk = (diagram?.players || []).find(
    (p) => p.team === 'ATT' && (p.number === 1 || String(p.role || '').toUpperCase() === 'GK')
  );
  if (gk && gk.y >= 70 && diagramLooksLikeFunction(diagram)) return true;
  if (!diagramLooksLikeFunction(diagram)) return false;
  const att = (diagram?.players || []).filter(
    (p) => p.team === 'ATT' && p.number !== 1 && String(p.role || '').toUpperCase() !== 'GK'
  );
  if (!att.length) return false;
  const avgY = att.reduce((s, p) => s + p.y, 0) / att.length;
  return avgY >= 55;
}

function scaleShouldDefend(
  current: WebDiagramV1 | undefined,
  message?: string,
  rosterHint?: string
): boolean {
  if (liveLooksLikeDefendingFunction(current)) return true;
  return /\b(defend(?:ing)? that (?:big )?goal|don['\u2019]?t flip|compact(?:ness)?|wide deliver)/i.test(
    [message, rosterHint].filter(Boolean).join('\n')
  );
}

export function lockDslForTurn(
  dsl: BoardSymbolicDsl,
  opts: {
    freeze: boolean;
    hasImage: boolean;
    importDrawEleven: boolean;
    fromCurrentBoard: boolean;
    keepPriorFrame: boolean;
    reshape: boolean;
    currentFormat?: '7V7' | '9V9' | '11V11';
    current?: WebDiagramV1;
    message?: string;
    rosterHint?: string;
  }
): BoardSymbolicDsl {
  let next = lockDslSeed(dsl, {
    freeze: opts.freeze,
    fromCurrentBoard: opts.fromCurrentBoard,
    keepPriorFrame: opts.keepPriorFrame,
    reshape: opts.reshape,
    hasImage: opts.hasImage,
    importDrawEleven: opts.importDrawEleven,
  });
  next = lockDslFormat(next, {
    message: opts.message,
    currentFormat: opts.currentFormat,
  });
  if (opts.freeze) {
    const liveIntent = String(opts.current?.areas?.[0]?.label || '');
    const pinned = (BOARD_GRID_INTENTS as readonly string[]).includes(liveIntent)
      ? (liveIntent as BoardSymbolicDsl['grid']['intent'])
      : next.grid.intent;
    next = {
      ...next,
      seed: 'current',
      moves: [],
      grid: { ...next.grid, intent: pinned },
    };
  }
  if (opts.message) {
    const inferred = inferFormationsFromMessage(opts.message);
    next = {
      ...next,
      grid: {
        ...next.grid,
        ...(inferred.att ? { attFormation: inferred.att } : {}),
        ...(inferred.def ? { defFormation: inferred.def } : {}),
      },
    };
  }
  if (!opts.freeze && opts.message) {
    const intent = inferGridIntentFromMessage(opts.message);
    const matchAfterFunction =
      Boolean(intent && intent !== 'rondo' && intent !== 'ssg_grid') &&
      (diagramLooksLikeFunction(opts.current) ||
        next.activity === 'rondo' ||
        next.grid.intent === 'rondo' ||
        next.activity === 'technical_exercise');
    if (intent) {
      const keepBlank =
        !matchAfterFunction &&
        (next.seed === 'blank' ||
          next.activity === 'rondo' ||
          next.activity === 'technical_exercise' ||
          opts.keepPriorFrame);
      next = {
        ...next,
        activity: matchAfterFunction ? 'match_scenario' : next.activity,
        seed: matchAfterFunction
          ? 'formation'
          : keepBlank
            ? 'blank'
            : opts.fromCurrentBoard || next.seed === 'current'
              ? 'current'
              : opts.reshape
                ? 'formation'
                : next.seed === 'blank'
                  ? 'blank'
                  : next.seed || 'formation',
        entities: matchAfterFunction ? [] : next.entities,
        equipment: matchAfterFunction ? [] : next.equipment,
        grid: {
          ...next.grid,
          intent:
            intent === 'rondo' ||
            intent === 'ssg_grid' ||
            matchAfterFunction ||
            next.grid.intent === 'full_pitch' ||
            !next.grid.intent
              ? intent
              : next.grid.intent,
          ...(matchAfterFunction &&
          opts.importDrawEleven &&
          scaleShouldDefend(opts.current, opts.message, opts.rosterHint)
            ? { attFormation: '4-4-2' as const, defFormation: '4-3-3' as const }
            : {}),
        },
      };
    }
  }
  if (
    !opts.freeze &&
    opts.importDrawEleven &&
    scaleShouldDefend(opts.current, opts.message, opts.rosterHint)
  ) {
    next = {
      ...next,
      activity: 'match_scenario',
      seed: 'formation',
      entities: [],
      equipment: [],
      actions: [],
      moves: [],
      grid: {
        ...next.grid,
        intent: 'full_pitch',
        attFormation: '4-4-2',
        defFormation: '4-3-3',
      },
    };
  }
  if (next.activity === 'rondo' || next.grid.intent === 'rondo') {
    next = { ...next, activity: 'rondo', grid: { ...next.grid, intent: 'rondo' } };
    next = ensureRondoRosterFromMessage(
      next,
      [opts.message, opts.rosterHint].filter(Boolean).join('\n')
    );
    next = promoteRondoNeutralsFromMessage(next, opts.message);
  }
  if (opts.hasImage || opts.rosterHint) {
    next = ensureImportOverloadRoster(next, [opts.message, opts.rosterHint].filter(Boolean).join('\n'));
  }
  next = retargetDslActionsFromMessage(next, opts.message, opts.current);
  next = ensureComboActionsFromMessage(next, opts.message, opts.current);
  next = lockDslFormat(next, {
    message: opts.message,
    currentFormat: opts.currentFormat,
  });
  next = ensureDslEquipmentFromMessage(
    next,
    [opts.message, opts.rosterHint].filter(Boolean).join('\n')
  );
  return stripUnmentionedRondoMiniGoals(
    next,
    [opts.message, opts.rosterHint].filter(Boolean).join('\n')
  );
}

function shirtIdForCombo(
  current: WebDiagramV1 | undefined,
  n: number,
  preferDef: boolean
): string {
  const all = current?.players || [];
  const defs = all.filter((p) => p.number === n && p.team === 'DEF');
  const atts = all.filter((p) => p.number === n && p.team === 'ATT');
  if (preferDef && defs[0]) return defs[0].id;
  if (atts[0]) return atts[0].id;
  if (defs[0]) return defs[0].id;
  if (preferDef) {
    const pool = all.filter(
      (p) => p.team === 'DEF' && p.number !== 1 && String(p.role || '').toUpperCase() !== 'GK'
    );
    const central = [...pool].sort(
      (a, b) => Math.abs(a.x - 50) + Math.abs(a.y - 50) - (Math.abs(b.x - 50) + Math.abs(b.y - 50))
    )[0];
    if (central) return central.id;
  }
  return `${preferDef ? 'def' : 'att'}-${n}`;
}

/** “9 plays wide to the 7 and the 7 delivers” must still emit arrows on a freeze. */
export function ensureComboActionsFromMessage(
  dsl: BoardSymbolicDsl,
  message?: string,
  current?: WebDiagramV1
): BoardSymbolicDsl {
  if (!message) return dsl;
  const wide = message.match(/\b(?:the )?(\d+)\s+plays wide to(?: the)? (\d+)\b/i);
  const delivers = message.match(/\b(?:the )?(\d+)\s+delivers\b/i);
  if (!wide && !delivers) return dsl;
  const preferDef =
    liveLooksLikeDefendingFunction(current) ||
    (current?.areas || []).some((a) => /ssg/i.test(String(a.label || '')));
  let actions = [...(dsl.actions || [])];
  if (wide) {
    const fromN = Number(wide[1]);
    const toN = Number(wide[2]);
    const from_id = shirtIdForCombo(current, fromN, preferDef);
    const to_id = shirtIdForCombo(current, toN, preferDef);
    if (!actions.some((a) => a.type === 'pass' && a.from_id === from_id && a.to_id === to_id)) {
      actions = [...actions, { type: 'pass' as const, from_id, to_id }];
    }
  }
  if (delivers) {
    const n = Number(delivers[1]);
    const from_id = shirtIdForCombo(current, n, preferDef);
    if (!actions.some((a) => (a.type === 'run' || a.type === 'pass') && a.from_id === from_id)) {
      actions = [...actions, { type: 'run' as const, from_id, to_id: 'att-1' }];
    }
  }
  return { ...dsl, actions };
}

function wantsBounceIntoEight(message?: string): boolean {
  return Boolean(
    message &&
      (/\bjump(?:s|ing)?(?: the)? 6\b/i.test(message) ||
        /\bbounce.{0,40}\b8\b/i.test(message) ||
        /\binto (?:the |our |ATT |att )?(?:CM )?\#?8\b/i.test(message))
  );
}

function bouncePasserNumber(
  current: WebDiagramV1 | undefined,
  bounceN: number,
  message?: string
): number {
  const att = (current?.players || []).filter((p) => p.team === 'ATT');
  const has = (n: number) => n !== bounceN && att.some((p) => p.number === n);
  if (/\b(?:our |the )?right\b/i.test(message || '')) {
    const n = [2, 7].find(has);
    if (n) return n;
  }
  if (/\b(?:our |the )?left\b/i.test(message || '')) {
    const n = [3, 11].find(has);
    if (n) return n;
  }
  return [2, 3, 4, 5].find(has) || bounceN;
}

function retargetDslActionsFromMessage(
  dsl: BoardSymbolicDsl,
  message?: string,
  current?: WebDiagramV1
): BoardSymbolicDsl {
  if (!message) return dsl;
  let actions = [...(dsl.actions || [])];
  const bounceN = bounceTargetNumber(current, 8);
  if (wantsBounceIntoEight(message)) {
    const passerN = bouncePasserNumber(current, bounceN, message);
    actions = actions.map((a) => {
      if (a.type !== 'pass') return a;
      const toAtt = /^att-(\d+)$/i.exec(a.to_id);
      if (!toAtt) return a;
      const toN = Number(toAtt[1]);
      const fromAtt = /^att-(\d+)$/i.exec(a.from_id);
      const fromShirt = fromAtt ? Number(fromAtt[1]) : null;
      const already = toN === bounceN && fromShirt !== bounceN;
      if (already) {
        if (fromShirt !== passerN && (fromShirt === 4 || fromShirt === 5)) {
          return { ...a, from_id: `att-${passerN}` };
        }
        return a;
      }
      const retarget =
        toN === 1 ||
        (bounceN === 8 && toN === 6) ||
        (bounceN !== 8 && (toN === 8 || toN === 7)) ||
        fromShirt === bounceN;
      if (!retarget) return a;
      let next = { ...a, to_id: `att-${bounceN}` };
      if (fromShirt === bounceN) {
        next = { ...next, from_id: `att-${passerN}` };
      }
      return next;
    });
  }
  const runShirt = namedRunShirt(message);
  if (runShirt != null) {
    const id = `att-${runShirt}`;
    const hasRun = actions.some((a) => a.type === 'run');
    actions = hasRun
      ? actions.map((a) => (a.type === 'run' ? { ...a, from_id: id } : a))
      : [...actions, { type: 'run' as const, from_id: id, to_id: 'def-1' }];
  }
  return { ...dsl, actions };
}

function bounceTargetNumber(current: WebDiagramV1 | undefined, prefer: number): number {
  const att = (current?.players || []).filter(
    (p) => p.team === 'ATT' && p.number !== 1 && String(p.role || '').toUpperCase() !== 'GK'
  );
  if (att.some((p) => p.number === prefer)) return prefer;
  const cm = [8, 6, 10, 4].find((n) => att.some((p) => p.number === n));
  return cm || prefer;
}

function namedRunShirt(message: string): number | null {
  const m =
    message.match(/\b(?:the )?(\d+)(?:'s|’s)? run\b/i) ||
    message.match(/\brun (?:from |off |in behind from )(?:the |our )?#?(\d+)\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function applyLockedDsl(
  dsl: BoardSymbolicDsl,
  current: WebDiagramV1,
  _message: string
): WebDiagramV1 | null {
  const solved = enforceBoardInvariants(solveBoardLayout(dsl, current), dsl);
  const inv = boardInvariantErrors(solved, dsl);
  const solvedN = solved.players?.length || 0;
  const currentN = current.players?.length || 0;
  // Abort a true upsample. Applying fewer shirts than the leftover default is progress.
  if (inv.some((e) => e.startsWith('upsample')) && solvedN >= currentN) return null;
  const validated = parseWebDiagramV1(solved);
  if (!validated.ok) return null;
  return validated.diagram;
}

function mapTeachingPlayers(
  diagram: WebDiagramV1,
  mapPlayer: (p: WebDiagramV1['players'][number]) => WebDiagramV1['players'][number]
): WebDiagramV1 {
  return {
    ...diagram,
    players: (diagram.players || []).map(mapPlayer),
    sequence: diagram.sequence
      ? {
          ...diagram.sequence,
          frames: diagram.sequence.frames.map((f) =>
            isFrozenStartFrame(f) || f.id === 'f-start'
              ? f
              : { ...f, players: (f.players || []).map(mapPlayer) }
          ),
        }
      : diagram.sequence,
  };
}

/** “Too deep / 6 higher” = toward the opponent (lower y), never toward our goal. */
export function nudgeAttSixHigher(diagram: WebDiagramV1, message: string): WebDiagramV1 {
  if (!/\b6\b/.test(message) || !/\b(too deep|higher|in front of their)\b/i.test(message)) {
    return diagram;
  }
  return mapTeachingPlayers(diagram, (p) => {
    if (p.team !== 'ATT' || p.number !== 6) return p;
    return { ...p, y: Math.max(8, Math.min(100, p.y - 18)) };
  });
}

/** “Drop the 8 without moving anyone else” — tuck that ATT shirt toward our goal (higher y). */
export function dropNamedShirt(diagram: WebDiagramV1, message: string): WebDiagramV1 {
  const m = message.match(/\bdrop(?:ping)?(?: the| our)? (\d+)\b/i);
  if (!m) return diagram;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return diagram;
  return mapTeachingPlayers(diagram, (p) => {
    if (p.team !== 'ATT' || p.number !== n) return p;
    return { ...p, y: Math.max(8, Math.min(100, p.y + 12)) };
  });
}

/** Pin “the 9’s run” to ATT #9 even if the model attached it to #10. Inject the run if missing. */
export function retargetNamedRunArrows(diagram: WebDiagramV1, message: string): WebDiagramV1 {
  const n = namedRunShirt(message);
  if (n == null) return diagram;
  const shirt = (diagram.players || []).find((p) => p.team === 'ATT' && p.number === n);
  if (!shirt) return diagram;
  const behind = { x: shirt.x, y: Math.max(6, shirt.y - 22) };
  const mapArrows = (arrows: WebDiagramV1['arrows'] | undefined) => {
    const next = (arrows || []).map((a) =>
      String(a.type).toLowerCase() === 'run' ? { ...a, from: { ...a.from, playerId: shirt.id } } : a
    );
    if (next.some((a) => String(a.type).toLowerCase() === 'run')) return next;
    return [
      ...next,
      {
        from: { playerId: shirt.id },
        to: behind,
        type: 'run' as const,
        style: 'dashed' as const,
        weight: 'normal' as const,
      },
    ];
  };
  return {
    ...diagram,
    arrows: mapArrows(diagram.arrows),
    sequence: diagram.sequence
      ? {
          ...diagram.sequence,
          frames: diagram.sequence.frames.map((f) =>
            isFrozenStartFrame(f) || f.id === 'f-start' ? f : { ...f, arrows: mapArrows(f.arrows) }
          ),
        }
      : diagram.sequence,
  };
}

export function retargetBouncePassArrows(diagram: WebDiagramV1, message: string): WebDiagramV1 {
  if (!wantsBounceIntoEight(message)) return diagram;
  const bounceN = bounceTargetNumber(diagram, 8);
  const fromN = bouncePasserNumber(diagram, bounceN, message);
  const idFor = (n: number) =>
    (diagram.players || []).find((p) => p.team === 'ATT' && p.number === n)?.id;
  const toId = idFor(bounceN);
  const fromId = idFor(fromN);
  if (!toId) return diagram;
  const mapArrows = (arrows: WebDiagramV1['arrows']) =>
    (arrows || []).map((a) => {
      if (a.type !== 'pass') return a;
      const toPlayer = (diagram.players || []).find((p) => p.id === a.to.playerId);
      const fromPlayer = (diagram.players || []).find((p) => p.id === a.from.playerId);
      if (toPlayer && toPlayer.team !== 'ATT') return a;
      const toN = toPlayer?.number;
      const fromShirt = fromPlayer?.number;
      if (toN == null) return a;
      const already = toN === bounceN && fromShirt !== bounceN;
      if (already) {
        if (fromShirt !== fromN && (fromShirt === 4 || fromShirt === 5) && fromId) {
          return { ...a, from: { playerId: fromId } };
        }
        return a;
      }
      const retarget =
        toN === 1 ||
        (bounceN === 8 && toN === 6) ||
        (bounceN !== 8 && (toN === 8 || toN === 7)) ||
        fromShirt === bounceN;
      if (!retarget) return a;
      let next = { ...a, to: { playerId: toId } };
      if (fromShirt === bounceN && fromId) {
        next = { ...next, from: { playerId: fromId } };
      }
      return next;
    });
  return {
    ...diagram,
    arrows: mapArrows(diagram.arrows),
    sequence: diagram.sequence
      ? {
          ...diagram.sequence,
          frames: diagram.sequence.frames.map((f) =>
            isFrozenStartFrame(f) || f.id === 'f-start' ? f : { ...f, arrows: mapArrows(f.arrows) }
          ),
        }
      : diagram.sequence,
  };
}

export function applyCoachShirtEdits(diagram: WebDiagramV1, message: string): WebDiagramV1 {
  return retargetDeliveryTowardGoal(
    retargetBouncePassArrows(
      retargetNamedRunArrows(
        dropNamedShirt(nudgeAttSixHigher(nudgeRondoCorrection(diagram, message), message), message),
        message
      ),
      message
    ),
    message
  );
}

/** “pinks on the ends / defenders compact” must actually move the rondo, not rebuild the same ellipse. */
export function nudgeRondoCorrection(diagram: WebDiagramV1, message: string): WebDiagramV1 {
  const t = String(message || '');
  const wantsEnds =
    /\b(on the ends?|short ends?|neutrals? on the)\b/i.test(t) ||
    (/\bpinks?\b/i.test(t) && /\b(ends?|sideline)\b/i.test(t));
  const wantsCompact = /\b(compact|tighter|inside)\b/i.test(t);
  if (!wantsEnds && !wantsCompact) return diagram;
  const n = diagram.players?.length || 0;
  if (n < 4 || n > 12) return diagram;
  const box = diagram.areas?.[0];
  const bx = Number(box?.x);
  const by = Number(box?.y);
  const bw = Number(box?.width);
  const bh = Number(box?.height);
  if (!Number.isFinite(bx) || !Number.isFinite(by) || !(bw > 8 && bh > 8)) return diagram;
  const cx = bx + bw / 2;
  const cy = by + bh / 2;
  const neus = (diagram.players || []).filter((p) => p.team === 'NEUTRAL');
  const atts = (diagram.players || []).filter((p) => p.team === 'ATT');
  const next = (diagram.players || []).map((p) => {
    if (wantsEnds && p.team === 'NEUTRAL' && neus.length >= 2) {
      const i = neus.findIndex((x) => x.id === p.id);
      // Short ends of the on-screen box = top/bottom (x). Paper 10×15 pinks sit there.
      if (i === 0) return { ...p, x: bx + Math.min(8, bw * 0.18), y: cy };
      if (i === 1) return { ...p, x: bx + bw - Math.min(8, bw * 0.18), y: cy };
    }
    if (wantsEnds && p.team === 'ATT' && atts.length >= 2) {
      const i = atts.findIndex((x) => x.id === p.id);
      if (i === 0) return { ...p, x: cx, y: by + Math.min(8, bh * 0.18) };
      if (i === 1) return { ...p, x: cx, y: by + bh - Math.min(8, bh * 0.18) };
    }
    if (wantsCompact && p.team === 'DEF') {
      return {
        ...p,
        x: clampPct(p.x * 0.5 + cx * 0.5),
        y: clampPct(p.y * 0.5 + cy * 0.5),
      };
    }
    return p;
  });
  const mapPlayers = (players: WebDiagramV1['players'] | undefined) => {
    if (!players?.length) return players;
    const byId = new Map(next.map((p) => [p.id, p]));
    return players.map((p) => byId.get(p.id) || p);
  };
  return {
    ...diagram,
    players: next,
    sequence: diagram.sequence
      ? {
          ...diagram.sequence,
          frames: diagram.sequence.frames.map((f) =>
            isFrozenStartFrame(f) || f.id === 'f-start' ? f : { ...f, players: mapPlayers(f.players) || f.players }
          ),
        }
      : diagram.sequence,
  };
}

function clampPct(n: number) {
  return Math.max(0, Math.min(100, n));
}

/** “the 7 delivers” from a DEF shirt goes into OUR box (RIGHT / high y), not their mini-goal end. */
export function retargetDeliveryTowardGoal(diagram: WebDiagramV1, message: string): WebDiagramV1 {
  if (!/\b(deliver(?:s|y|ed)?|cross(?:es|ed)?)\b/i.test(message)) return diagram;
  const m = String(message).match(/\b(?:the )?(\d+)\s+delivers\b/i);
  const n = m ? Number(m[1]) : NaN;
  if (!Number.isFinite(n)) return diagram;
  const shirt = (diagram.players || []).find((p) => p.number === n);
  if (!shirt) return diagram;
  const towardOurGoal =
    shirt.team === 'DEF' || liveLooksLikeDefendingFunction(diagram);
  const y = towardOurGoal ? Math.min(92, Math.max(shirt.y + 16, 78)) : Math.max(8, shirt.y - 22);
  const mapArrows = (arrows: WebDiagramV1['arrows'] | undefined) =>
    (arrows || []).map((a) => {
      if (a.from.playerId !== shirt.id) return a;
      const kind = String(a.type || '').toLowerCase();
      if (kind !== 'run' && kind !== 'pass' && kind !== 'cross' && kind !== 'delivery') return a;
      const toY = typeof a.to.y === 'number' ? a.to.y : towardOurGoal ? 0 : 100;
      const wrongWay = towardOurGoal ? toY < 60 : toY > 40;
      if (!wrongWay && typeof a.to.y === 'number') return a;
      return { ...a, type: kind === 'pass' ? a.type : 'run', to: { x: shirt.x, y } };
    });
  return {
    ...diagram,
    arrows: mapArrows(diagram.arrows),
    sequence: diagram.sequence
      ? {
          ...diagram.sequence,
          frames: diagram.sequence.frames.map((f) =>
            isFrozenStartFrame(f) || f.id === 'f-start' ? f : { ...f, arrows: mapArrows(f.arrows) }
          ),
        }
      : diagram.sequence,
  };
}

function unstackDiagramPlayers(diagram: WebDiagramV1): WebDiagramV1 {
  return unstackDiagram(diagram);
}

function wantsCurrentBoardSeed(message: string): boolean {
  return /\b(from this board|from there|from here|looking at the board|keep these players|keep (?:the )?(?:players?|shirts?)|keep us|don['\u2019]?t flip|do not flip|don['\u2019]?t restack|do not restack)\b/i.test(
    message
  );
}

/** Freeze the current picture as Frame 1, then draw a new activity on later frames. */
export function wantsKeepPriorFrame(message: string): boolean {
  return /\bfreeze (?:this |the )?(?:board|picture|setup|diagram)\b/i.test(message);
}

function wantsSequenceFromMessage(message: string): boolean {
  return /\b(sequence|sequences|multi[- ]?step|frame by frame|frames?|step by step|steps|progression|then |next (?:phase|moment|step)|animate|playback|play it out|show (?:the )?play develop|phases? of (?:the )?play|variances?|variants?|combination plays?|combo plays?|\d+\s+plays?)\b/i.test(
    message
  );
}

/** Coach forbade moving shirts — arrows/captions only. */
export function wantsFrozenPlayers(message: string): boolean {
  const m = String(message || '');
  if (
    /\b(without moving|don['\u2019]?t move|do not move|nobody else moves|don['\u2019]?t restack|do not restack|don['\u2019]?t flip|do not flip)\b/i.test(
      m
    )
  ) {
    return true;
  }
  // "freeze that, then a pass" — not "freeze this board and show a rondo".
  if (
    /\bfreeze that\b/i.test(m) &&
    !/\b(rondo|ssg|high press|mid[- ]?block|2-3-1|3-2-3|11\s*v\s*11)\b/i.test(m)
  ) {
    return true;
  }
  return /\b(keep (?:the )?(?:players?|shirts?|positions?|coordinates?) (?:fixed|still|as[- ]is)|leave (?:the )?(?:players?|shirts?)|freeze (?:the )?(?:players?|shirts?|positions?)|coordinates? fixed|as they (?:are|stand)|no (?:player )?movement)\b/i.test(
    m
  );
}

export function wantsScaleToEleven(message: string): boolean {
  return /\bscale.{0,60}11\s*v\s*11\b|\bsame idea.{0,40}11\s*v\s*11\b|\b11\s*v\s*11.{0,40}scale\b/i.test(
    String(message || '')
  );
}

function lockPlayersToRoster(
  players: WebDiagramV1['players'] | undefined,
  roster: WebDiagramV1['players']
): WebDiagramV1['players'] {
  if (!roster.length) return players || [];
  return roster.map((orig) => {
    const live = (players || []).find((p) => p.id === orig.id);
    return {
      ...orig,
      facingAngle: live?.facingAngle ?? orig.facingAngle,
      labelStyle: live?.labelStyle ?? orig.labelStyle,
    };
  });
}

export function lockSequencePlayersToOriginal(
  result: WebDiagramV1,
  original: WebDiagramV1
): WebDiagramV1 {
  const roster = original.players || [];
  if (!roster.length) return result;
  const frames = result.sequence?.frames?.map((f, i) => ({
    ...f,
    players: i === 0 && isFrozenStartFrame(f) ? f.players : lockPlayersToRoster(f.players, roster),
  }));
  return {
    ...result,
    players: lockPlayersToRoster(result.players, roster),
    sequence: frames
      ? {
          frames,
          activeFrameId:
            frames.find((f) => f.id === result.sequence?.activeFrameId)?.id || frames[0].id,
        }
      : result.sequence,
  };
}

/** Drop dummy reshape slides when the coach froze the picture. */
function dropReshapeFramesWhenFrozen(frames: SeqFrame[]): SeqFrame[] {
  if (frames.length < 3) return frames;
  const start = frames[0];
  const rest = frames.slice(1).filter((f) => {
    const title = String(f.title || '').toLowerCase();
    const reshape = /\b(initial shape|reshape|re-?shape|new shape)\b/.test(title);
    const arrows = f.arrows?.length || 0;
    if (reshape && arrows < 3) return false;
    return true;
  });
  if (!rest.length) return frames;
  return [start, ...rest];
}

function expectedMatchShirts(diagram: WebDiagramV1): number {
  const format = diagram.pitch?.format;
  return format === '7V7' ? 14 : format === '9V9' ? 18 : 22;
}

function isFrozenStartFrame(frame?: SeqFrame | null): boolean {
  return /\bfrozen board\b/i.test(String(frame?.note || ''));
}

function isStartLikeFrame(frame?: { id?: string; title?: string; note?: string } | null): boolean {
  if (!frame) return false;
  if (/\bfrozen board\b/i.test(String(frame.note || '')) || frame.id === 'f-start') return true;
  const t = String(frame.title || '')
    .trim()
    .toLowerCase()
    .replace(/^\d+\.\s*/, '');
  return t === 'start' || t === 'start (board)' || t.startsWith('start (');
}

const FROZEN_START_NOTE =
  'Frozen board — keep this picture as Frame 1 for later teaching sequences.';

function snapshotBoardLayers(
  diagram: Pick<
    WebDiagramV1,
    'players' | 'arrows' | 'areas' | 'labels' | 'balls' | 'goals' | 'coach' | 'cones' | 'elements'
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
    elements: diagram.elements,
  };
}

function playerSetupSignature(players: WebDiagramV1['players'] | undefined): string {
  return (players || [])
    .map((p) => `${p.id}:${Math.round(p.x)}:${Math.round(p.y)}:${p.team}`)
    .sort()
    .join('|');
}

function startLikeTitle(title?: string): boolean {
  const t = String(title || '')
    .trim()
    .toLowerCase()
    .replace(/^\d+\.\s*/, '');
  return (
    t === 'start' ||
    t === 'start (board)' ||
    t === 'saved board' ||
    t === 'current board' ||
    t === 'original' ||
    (/^start\b/.test(t) && /\bboard\b/.test(t))
  );
}

/** Drop the model's duplicate "Start (board)" so we only prepend one real start. */
function stripLeadingStartFrames(aiFrames: SeqFrame[], startFrame: SeqFrame): SeqFrame[] {
  let teaching = [...aiFrames];
  while (teaching.length) {
    const f = teaching[0];
    const titleStart = startLikeTitle(f.title);
    const samePlayers =
      playerSetupSignature(f.players) === playerSetupSignature(startFrame.players);
    const extraArrows = (f.arrows?.length || 0) - (startFrame.arrows?.length || 0);

    if (titleStart && extraArrows > 0) {
      teaching = [{ ...f, title: 'Play' }, ...teaching.slice(1)];
      break;
    }
    if (titleStart || (samePlayers && extraArrows <= 0)) {
      teaching = teaching.slice(1);
      continue;
    }
    break;
  }
  return teaching;
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
  const need = expectedMatchShirts(original);
  const priorStart = original.sequence?.frames?.[0];
  const priorN = priorStart?.players?.length || 0;
  const liveN = (original.players || []).length;
  const keepExistingFilmstrip =
    isFrozenStartFrame(priorStart) ||
    (Boolean(priorStart) && priorN >= need - 2 && liveN < priorN && liveN < need);
  const wantsSeq =
    wantsSequenceFromMessage(message) ||
    isPlayOutRequest(message) ||
    wantsKeepPriorFrame(message) ||
    /\bfreeze that\b/i.test(message) ||
    (wantsCurrentBoardSeed(message) && Boolean(inferGridIntentFromMessage(message))) ||
    aiFrames.length >= 2 ||
    keepExistingFilmstrip;

  const leavingFunction =
    looksLikeFunctionPractice(original) &&
    !looksLikeFunctionPractice(result) &&
    (result.players || []).length >= need - 2;
  if (leavingFunction) {
    const playLayers = snapshotBoardLayers(result);
    const startFrame: SeqFrame = {
      id: 'f-start',
      title: '1. Start (board)',
      durationMs: 1600,
      ...playLayers,
      arrows: [],
    };
    const play: SeqFrame = {
      id: 'f-2',
      title: '2. Play',
      durationMs: 1600,
      ...playLayers,
    };
    return {
      ...result,
      sequence: { frames: [startFrame, play], activeFrameId: 'f-2' },
    };
  }

  if (!wantsSeq) {
    const origFrames = original.sequence?.frames || [];
    const nextFrames = result.sequence?.frames || [];
    const sameRoster =
      (result.players || []).length === (original.players || []).length &&
      (result.players || []).length > 0;
    if (origFrames.length >= 2 && nextFrames.length < 2 && sameRoster) {
      const play: SeqFrame = {
        id: 'f-2',
        title: '2. Play',
        durationMs: 1600,
        ...snapshotBoardLayers(result),
      };
      return {
        ...result,
        sequence: {
          frames: [origFrames[0], play],
          activeFrameId: 'f-2',
        },
      };
    }
    return result;
  }

  const freezePlayers = wantsFrozenPlayers(message);
  const liveLayers = snapshotBoardLayers(original);
  const freezeThisTurn = wantsKeepPriorFrame(message);
  const keepFrozenStart =
    isFrozenStartFrame(priorStart) ||
    (Boolean(priorStart) && priorN >= need - 2 && liveN < priorN && liveN < need);
  const startLayers =
    keepFrozenStart && priorStart ? snapshotBoardLayers(priorStart) : liveLayers;
  const startFrame: SeqFrame = {
    id: 'f-start',
    title: '1. Start (board)',
    note:
      freezeThisTurn || keepFrozenStart
        ? FROZEN_START_NOTE
        : 'Saved starting picture — original positions before the teaching sequence.',
    durationMs: keepFrozenStart ? priorStart?.durationMs || 1600 : 1600,
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
  } else {
    teaching = stripLeadingStartFrames(aiFrames, startFrame);
    if (!teaching.length) {
      teaching = [
        {
          id: 'f-2',
          title: '2. Play',
          durationMs: 1600,
          ...snapshotBoardLayers(result),
        },
      ];
    }
  }

  const rest = teaching.map((f, i) => ({
    ...f,
    id: f.id && f.id !== 'f-start' ? f.id : `f-${i + 2}`,
    title: startLikeTitle(f.title)
      ? renumberFrameTitle('Play', i + 2)
      : renumberFrameTitle(f.title, i + 2),
  }));

  const frames = freezePlayers
    ? dropReshapeFramesWhenFrozen([startFrame, ...rest]).slice(0, BOARD_AI_SEQUENCE_MAX_FRAMES)
    : [startFrame, ...rest].slice(0, BOARD_AI_SEQUENCE_MAX_FRAMES);
  const active = frames[Math.min(1, frames.length - 1)] || frames[0];
  const locked = freezePlayers
    ? lockSequencePlayersToOriginal(
        {
          ...result,
          ...snapshotBoardLayers(active),
          pitch: result.pitch || original.pitch,
          sequence: { frames, activeFrameId: active.id },
        },
        original
      )
    : null;

  return (
    locked || {
      ...result,
      ...snapshotBoardLayers(active),
      pitch: result.pitch || original.pitch,
      sequence: {
        frames,
        activeFrameId: active.id,
      },
    }
  );
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

function isGkPlayerLoose(p: { number?: number; role?: string }) {
  return p.number === 1 || String(p.role || '').toUpperCase() === 'GK';
}

/** Function / SSG / rondo — not a full match picture for this format. */
export function looksLikeFunctionPractice(diagram: WebDiagramV1): boolean {
  const players = diagram.players || [];
  const n = players.length;
  const need = expectedMatchShirts(diagram);
  // 7v7 match is 14 shirts — must not count as a rondo just because n ≤ 16.
  if (n >= need - 2) return false;
  if ((diagram.elements || []).some((e) => e.kind === 'mini-goal')) return true;
  if (n > 0 && n <= 16) return true;
  const gks = players.filter(isGkPlayerLoose);
  return gks.length <= 1 && n > 0 && n < need;
}

function largestArea(diagram: WebDiagramV1) {
  const areas = (diagram.areas || []).filter(
    (a) => typeof a.x === 'number' && typeof a.y === 'number'
  );
  if (!areas.length) return null;
  return areas.slice().sort((a, b) => {
    const aa = (a.width ?? 10) * (a.height ?? 10);
    const bb = (b.width ?? 10) * (b.height ?? 10);
    return bb - aa;
  })[0];
}

function swapAttDefTeams(diagram: WebDiagramV1): WebDiagramV1 {
  return {
    ...diagram,
    players: (diagram.players || []).map((p) =>
      p.team === 'ATT' ? { ...p, team: 'DEF' as const } : p.team === 'DEF' ? { ...p, team: 'ATT' as const } : p
    ),
  };
}

function flipPointLength<T extends { x: number; y: number }>(p: T): T {
  return { ...p, y: clamp01to100Local(100 - p.y) };
}

function flipRefLength(ref: { playerId?: string; x?: number; y?: number } | undefined) {
  if (!ref) return ref;
  if (typeof ref.x === 'number' && typeof ref.y === 'number') {
    return { ...ref, y: clamp01to100Local(100 - ref.y) };
  }
  return ref;
}

/** Mirror along the goal-to-goal axis so a practice drawn at the LEFT goal sits at the RIGHT (us) goal. */
export function flipDiagramLength(diagram: WebDiagramV1): WebDiagramV1 {
  const players = (diagram.players || []).map((p) => flipPointLength(p));
  const balls = (diagram.balls || []).map((b) =>
    typeof b.x === 'number' && typeof b.y === 'number' ? flipPointLength(b) : b
  );
  const labels = (diagram.labels || []).map((l) => flipPointLength(l));
  const cones = (diagram.cones || []).map((c) => flipPointLength(c));
  const elements = (diagram.elements || []).map((el) => ({
    ...flipPointLength(el),
    rotation:
      typeof el.rotation === 'number' ? (((el.rotation + 180) % 360) + 360) % 360 : el.rotation,
  }));
  const goals = (diagram.goals || []).map((g) => flipPointLength(g));
  const areas = (diagram.areas || []).map((a) => {
    if (typeof a.x !== 'number' || typeof a.y !== 'number') return a;
    const h = a.height ?? 10;
    return { ...a, y: clamp01to100Local(100 - a.y - h) };
  });
  const arrows = (diagram.arrows || []).map((a) => ({
    ...a,
    from: flipRefLength(a.from) || a.from,
    to: flipRefLength(a.to) || a.to,
    ...(a.control && typeof a.control.x === 'number' && typeof a.control.y === 'number'
      ? { control: flipPointLength(a.control) }
      : {}),
    ...(a.path
      ? {
          path: a.path.map((pt) =>
            typeof pt.x === 'number' && typeof pt.y === 'number' ? flipPointLength(pt) : pt
          ),
        }
      : {}),
  }));
  const coach =
    diagram.coach && typeof diagram.coach.x === 'number' && typeof diagram.coach.y === 'number'
      ? flipPointLength(diagram.coach)
      : diagram.coach;
  return {
    ...diagram,
    players,
    balls,
    labels,
    cones,
    elements,
    goals,
    areas,
    arrows,
    coach,
  };
}

/**
 * Function practice: our goal is RIGHT. If the GK / boxed area landed on the left,
 * flip it. The unit with the GK (the coached defending unit) is ATT / blue.
 */
export function repairImportPracticeLayout(diagram: WebDiagramV1): WebDiagramV1 {
  if (!looksLikeFunctionPractice(diagram)) return diagram;
  let d = diagram;
  const gk = (d.players || []).find(isGkPlayerLoose);
  const main = largestArea(d);
  const anchorY =
    gk?.y ??
    (main && typeof main.y === 'number' ? main.y + (main.height ?? 10) / 2 : null);
  if (anchorY != null && anchorY < 48) {
    d = flipDiagramLength(d);
  }
  const gk2 = (d.players || []).find(isGkPlayerLoose);
  if (gk2 && gk2.team === 'DEF') {
    d = swapAttDefTeams(d);
  } else {
    d = repairBoardDiagramTeamEnds(d);
  }
  const gk3 = (d.players || []).find(isGkPlayerLoose);
  const box = largestArea(d);
  if (gk3 && box && typeof box.x === 'number' && typeof box.y === 'number') {
    const w = box.width ?? 10;
    const h = box.height ?? 10;
    if (!pointInArea(gk3, { x: box.x, y: box.y, width: w, height: h })) {
      const nextY = clamp01to100Local(gk3.y - h * 0.72);
      d = {
        ...d,
        areas: (d.areas || []).map((a) =>
          a === box || (a.x === box.x && a.y === box.y) ? { ...a, y: nextY } : a
        ),
      };
    }
  }
  return d;
}

/**
 * Detect when the model drew attack along diagram-x (vertical on a HORIZONTAL pitch)
 * and remap to goal-to-goal on diagram-y.
 * Symptom: GKs separated mostly on x near midfield y, instead of on y near midfield x.
 */
export function isBoardOrientationSwapped(diagram: WebDiagramV1): boolean {
  const players = diagram.players || [];
  if (players.length < 4) return false;

  const attGk = players.find((p) => p.team === 'ATT' && isGkPlayerLoose(p));
  const defGk = players.find((p) => p.team === 'DEF' && isGkPlayerLoose(p));
  const gk = attGk || defGk || players.find(isGkPlayerLoose);

  const touchlineDist = (p: { x: number; y: number }) => Math.min(p.x, 100 - p.x);
  const goalLineDist = (p: { x: number; y: number }) => Math.min(p.y, 100 - p.y);

  // Two GKs: swapped if they sit top↔bottom instead of left↔right
  if (attGk && defGk) {
    const ySpan = Math.abs(attGk.y - defGk.y);
    const xSpan = Math.abs(attGk.x - defGk.x);
    return xSpan > 40 && xSpan > ySpan + 12;
  }

  // One GK / function: GK belongs on a goal line (LEFT/RIGHT), not a touchline (TOP/BOTTOM).
  if (gk) {
    if (touchlineDist(gk) < 30 && touchlineDist(gk) + 10 < goalLineDist(gk)) {
      return true;
    }
  }

  const xs = players.map((p) => p.x);
  const ys = players.map((p) => p.y);
  const xSpread = Math.max(...xs) - Math.min(...xs);
  const ySpread = Math.max(...ys) - Math.min(...ys);
  // Session stacked along the width axis (top↔bottom on screen)
  if (xSpread > ySpread + 16 && xSpread > 30) return true;

  return false;
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

  const elements = (diagram.elements || []).map((el) => ({
    ...el,
    ...remapSwappedPoint(el),
    rotation:
      typeof el.rotation === 'number' ? (((el.rotation + 90) % 360) + 360) % 360 : el.rotation,
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
    elements,
    coach,
  };
}

/**
 * DEF own goal is LEFT (low y); ATT own goal is RIGHT (high y).
 * If the model painted the defending unit as red on the right, swap shirts.
 */
export function repairBoardDiagramTeamEnds(diagram: WebDiagramV1): WebDiagramV1 {
  const players = diagram.players || [];
  const att = players.filter((p) => p.team === 'ATT');
  const def = players.filter((p) => p.team === 'DEF');
  if (att.length < 3 || def.length < 3) return diagram;
  const avgY = (list: typeof players) => list.reduce((s, p) => s + p.y, 0) / list.length;
  if (avgY(def) <= avgY(att) + 12) return diagram;
  return {
    ...diagram,
    players: players.map((p) =>
      p.team === 'ATT' ? { ...p, team: 'DEF' } : p.team === 'DEF' ? { ...p, team: 'ATT' } : p
    ),
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

function isImportJustDraw(message: string): boolean {
  return /\bjust draw(?: it)?\b/i.test(String(message || ''));
}

function isTinyBoardOp(message: string): boolean {
  return /\b(clear (?:the )?board|reset (?:the )?board|remove (?:all )?arrows|delete (?:the )?label|undo)\b/i.test(
    message
  );
}

function historyWithoutCurrentTurn(
  history: BoardAiChatMessage[],
  message: string
): BoardAiChatMessage[] {
  if (!history.length) return [];
  const last = history[history.length - 1];
  if (last.role === 'user' && last.content.trim() === message.trim()) {
    return history.slice(0, -1);
  }
  return history;
}

const ASK_READINGS_CTA =
  'Reply **1**, **2**, or **3**. Or say **just draw it** for option 1.';

export const SOURCE_DIAGRAMS_CTA =
  'Reply **all** to put each diagram on its own frame.';

export const IMPORT_REVIEW_CTA =
  'Reply **A A A** (pictures · us · draw). Or say **just draw it** for first diagram, coached team, as written.';

export const IMPORT_REVIEW_QUESTIONS = [
  'Questions — I will not guess. Pick one letter per line.',
  '',
  'Q1 Pictures',
  '- **A** first diagram only',
  '- **B** every diagram, each on its own frame',
  '- **C** a specific one (name it)',
  '',
  'Q2 Who is us',
  '- **A** the team being coached in the session',
  '- **B** the attacking side',
  '- **C** as labelled in the file',
  '',
  'Q3 How to draw',
  '- **A** as written (area, numbers, mini-goals, floaters — do not scale to 11v11)',
  '- **B** same idea scaled to 11v11 on this board',
  '',
  IMPORT_REVIEW_CTA,
].join('\n');

export type ImportReviewAnswers = {
  pictures: 'first' | 'all' | 'named';
  us: 'coached' | 'attackers' | 'labelled';
  draw: 'as_written' | 'eleven';
  namedHint: string | null;
};

export function assistantOfferedImportReview(history: BoardAiChatMessage[]): boolean {
  const last = [...history].reverse().find((m) => m.role === 'assistant');
  return /Q1 Pictures|Reply \*\*A A A\*\*|I will not guess/i.test(last?.content || '');
}

export function parseImportReviewAnswers(message: string): ImportReviewAnswers | null {
  const t = String(message || '').trim();
  if (!t) return null;
  if (isImportJustDraw(t)) {
    return { pictures: 'first', us: 'coached', draw: 'as_written', namedHint: null };
  }
  const q1 = t.match(/q\s*1[:\s.)-]*([ABC])/i)?.[1];
  const q2 = t.match(/q\s*2[:\s.)-]*([ABC])/i)?.[1];
  const q3 = t.match(/q\s*3[:\s.)-]*([ABC])/i)?.[1];
  let a = q1?.toUpperCase() || '';
  let b = q2?.toUpperCase() || '';
  let c = q3?.toUpperCase() || '';
  if (!a || !b || !c) {
    const compact = t.replace(/[\s,.;:|/_*-]/g, '').toUpperCase();
    const m = compact.match(/^([ABC])([ABC])([ABC])/);
    if (m) {
      a = a || m[1];
      b = b || m[2];
      c = c || m[3];
    }
  }
  if (!a || !b || !c) return null;
  const namedHint =
    a === 'C'
      ? t.replace(/q\s*[123][:\s.)-]*[ABC]/gi, '').replace(/[ABC](?:\s+[ABC]){0,2}/gi, '').trim().slice(0, 160) ||
        null
      : null;
  return {
    pictures: a === 'B' ? 'all' : a === 'C' ? 'named' : 'first',
    us: b === 'B' ? 'attackers' : b === 'C' ? 'labelled' : 'coached',
    draw: c === 'B' ? 'eleven' : 'as_written',
    namedHint,
  };
}

function formatImportLocks(answers: ImportReviewAnswers): string {
  const pictures =
    answers.pictures === 'all'
      ? 'every source diagram, one frame each'
      : answers.pictures === 'named'
        ? `only this picture: ${answers.namedHint || '(coach named it — use their words)'}`
        : 'first diagram only';
  const us =
    answers.us === 'attackers'
      ? 'us = the attacking side'
      : answers.us === 'labelled'
        ? 'us = as labelled in the file'
        : 'us = the team being coached in the session';
  const draw =
    answers.draw === 'eleven'
      ? 'scale the same idea to 11v11 on this board'
      : 'draw the practice AS WRITTEN — do not scale to 11v11';
  return [`LOCKED IMPORT ANSWERS (do not guess):`, `- Pictures: ${pictures}`, `- ${us}`, `- ${draw}`].join('\n');
}

const IMPORT_REVIEW_BLOCK_START =
  /(?:^|\n)\s*(?:\*{0,2}Questions\b[\s\S]{0,80}I will not guess|\*{0,2}Q1 Pictures\b)/i;

function stripImportReviewQuestions(reply: string): string {
  let t = String(reply || '').replace(/\r\n/g, '\n');
  const idx = t.search(IMPORT_REVIEW_BLOCK_START);
  if (idx >= 0) t = t.slice(0, idx);
  t = t.replace(/(?:^|\n)\s*(?:\*{0,2}On the board\b[\s\S]*)$/i, '');
  t = t.replace(/(?:^|\n)\s*(?:\*{0,2}Coaching points\b[\s\S]*)$/i, '');
  return t.trim();
}

function ensureImportReviewQuestions(reply: string): string {
  const body = stripImportReviewQuestions(scrubImportOrganisation(reply));
  return body ? `${body}\n\n${IMPORT_REVIEW_QUESTIONS}` : IMPORT_REVIEW_QUESTIONS;
}

/** Compactness 50×50 reviews that said 6v6+GK still counted 7 golds — name 7v6+GK.
 *  20×20 increasing-pressure reviews that said 5v1+4 outside floaters are 5v5. */
export function scrubImportOrganisation(text: string): string {
  let t = String(text || '');
  const compact = /\b(50\s*[x×]\s*50|compact(?:ness)?|wide deliver|7\s*v\s*6)\b/i.test(t);
  if (compact) {
    t = t
      .replace(/\bOrganisation:?\s*6\s*v\s*6\s*\+\s*(?:2\s*)?GK(?:\s+plus\s+neutral\/?server)?\b/gi, 'Organisation: 7v6 + GK')
      .replace(/\b6\s*v\s*6\s*\+\s*(?:2\s*)?GK(?:\s+plus\s+neutral\/?server)?\b/gi, '7v6 + GK');
  }
  if (/\b(20\s*[x×]\s*20|increasing pressure|four\s+mini[- ]?goals?|inner\s*10|5\s*v\s*5)\b/i.test(t)) {
    t = t
      .replace(/\bOrganisation:?\s*5\s*v\s*1\s*\+\s*4(?:\s+outside)?(?:\s+floaters?)?\b/gi, 'Organisation: 5v5')
      .replace(/\b5\s*v\s*1\s*\+\s*4(?:\s+outside)?(?:\s+floaters?)?\b/gi, '5v5');
    if (/\b5\s*v\s*5\b/i.test(t)) {
      t = t
        .replace(/\b5v5\s*\+\s*(?:1\s*)?GK\b/gi, '5v5')
        .replace(/\bplus(?: a)? goalkeepers?\b/gi, '')
        .replace(/\+\s*(?:a )?GK\b/gi, '')
        .replace(/\(\s*\d+ numbered players plus(?: a)? goalkeeper\s*\)/gi, '')
        .replace(/\b(?:a |the )?(?:GK|goalkeepers?) waiting outside\b/gi, '')
        .replace(/\bdefenders waiting outside\b/gi, '')
        .replace(/\bwith(?: a)? GK\b/gi, '')
        .replace(/\band GK\b/gi, '');
    }
  }
  return t;
}

export function assistantOfferedSourceDiagrams(history: BoardAiChatMessage[]): boolean {
  const last = [...history].reverse().find((m) => m.role === 'assistant');
  return /Reply \*\*all\*\* to put each diagram|drew (?:the )?first diagram|drew diagram 1 of /i.test(
    last?.content || ''
  );
}

export function wantsAllSourceDiagrams(
  message: string,
  history: BoardAiChatMessage[] = []
): boolean {
  const t = String(message || '').trim();
  if (!t) return false;
  if (/^(all|all \d+|the rest|remaining)$/i.test(t)) return true;
  if (
    /\b(all (?:\d+ )?diagrams?|draw all|every diagram|other diagrams?|rest of the diagrams?|all frames|each diagram)\b/i.test(
      t
    )
  ) {
    return true;
  }
  if (
    assistantOfferedSourceDiagrams(history) &&
    /^(yes|y|ok|okay|sure|do it|please)$/i.test(t)
  ) {
    return true;
  }
  return false;
}

function fileLooksLikeSingleDiagram(reply: string): boolean {
  if (/\bonly (?:one|1) (?:tactical )?(?:diagram|picture)\b/i.test(reply)) return true;
  const m = reply.match(/diagram 1 of (\d+)/i);
  if (m) return Number(m[1]) <= 1;
  return false;
}

function ensureSourceDiagramFollowUp(reply: string, drewAll: boolean): string {
  if (drewAll) return reply;
  if (/Reply \*\*all\*\* to put each diagram/i.test(reply)) return reply;
  if (fileLooksLikeSingleDiagram(reply)) return reply;
  const alreadyNoted = /drew diagram 1 of |drew the first diagram/i.test(reply);
  const diagramsBlock = alreadyNoted
    ? `\n\n${SOURCE_DIAGRAMS_CTA}`
    : `\n\nDiagrams\n- Drew the first diagram from the file.\n- ${SOURCE_DIAGRAMS_CTA}`;
  return `${reply.trim()}${diagramsBlock}`;
}

const WORD_TO_COUNT: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
};

export type BoardAskChannel = 'left' | 'right' | 'central';

export type BoardAskReading = {
  n: 1 | 2 | 3;
  title: string;
  summary: string;
  freezePlayers: boolean;
  reshape: boolean;
  sequence: boolean;
  playCount: number | null;
  channel: BoardAskChannel | null;
  startFromFrame: number | null;
  intent: string;
};

function parseCountToken(raw: string): number | null {
  const key = raw.toLowerCase();
  if (WORD_TO_COUNT[key]) return WORD_TO_COUNT[key];
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 && n <= 8 ? n : null;
}

export function parsePickedReadingIndex(message: string): 1 | 2 | 3 | null {
  const t = String(message || '').trim();
  if (!t) return null;
  if (
    /^(?:just draw(?: it)?|draw it(?: now)?|use defaults?|go ahead|apply(?: it)?(?: now)?|yes|y|ok|okay|sure|do it|proceed)$/i.test(
      t
    )
  ) {
    return 1;
  }
  const isolated = t.match(/^(?:option\s*)?([123])(?:\s*[.)])?\s*$/i);
  if (isolated) return Number(isolated[1]) as 1 | 2 | 3;
  const named = t.match(/^(one|two|three)\s*$/i);
  if (named) {
    const n = WORD_TO_COUNT[named[1].toLowerCase()];
    return n === 1 || n === 2 || n === 3 ? n : null;
  }
  const goWith = t.match(
    /^(?:go with|pick|choose|use|option)\s*(?:option\s*)?([123]|one|two|three)\s*$/i
  );
  if (goWith) {
    const n = parseCountToken(goWith[1]);
    return n === 1 || n === 2 || n === 3 ? n : null;
  }
  // Title aliases are picks only when the coach is naming an option, not correcting a picture.
  if (/\bthat'?s not it\b|\bno wait\b|\bnot back to\b/i.test(t)) return null;
  if (t.length > 90) return null;
  if (/\bjump(?:ing)? the 6\b/i.test(t)) return 1;
  if (/\btrap wide\b/i.test(t)) return 2;
  if (/\bsqueeze the 9\b/i.test(t)) return 3;
  if (/\bsplit cbs\b/i.test(t)) return 1;
  if (/\bwide fullback triangle\b/i.test(t)) return 2;
  if (/\bbounce off the 8\b/i.test(t)) return 3;
  return null;
}

export function assistantOfferedAskReadings(history: BoardAiChatMessage[]): boolean {
  const last = [...history].reverse().find((m) => m.role === 'assistant');
  const t = last?.content || '';
  return (
    /Reply \*\*1\*\*, \*\*2\*\*, or \*\*3\*\*/i.test(t) ||
    /ways to play that/i.test(t) ||
    /how I can draw that/i.test(t)
  );
}

function lastAssistantWasClarify(history: BoardAiChatMessage[]): boolean {
  const last = [...history].reverse().find((m) => m.role === 'assistant');
  return /need a few details before I draw|I’ll set the board/i.test(last?.content || '');
}

function lastNonPickUserAsk(history: BoardAiChatMessage[]): string | null {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const m = history[i];
    if (m.role !== 'user') continue;
    if (parsePickedReadingIndex(m.content) != null) continue;
    return m.content.trim() || null;
  }
  return null;
}

export function collectCoachAsk(message: string, history: BoardAiChatMessage[]): string {
  const picked = parsePickedReadingIndex(message) != null;
  if (picked || (isForceDrawRequest(message) && assistantOfferedAskReadings(history))) {
    return lastNonPickUserAsk(history) || message;
  }
  if (lastAssistantWasClarify(history)) {
    const prev = lastNonPickUserAsk(history);
    if (prev && prev !== message.trim()) return `${prev}\n${message}`.trim();
  }
  return message;
}

export function inferPlayCountFromMessage(message: string): number | null {
  const plays = String(message || '').match(
    /\b(one|two|three|four|five|\d+)\s+(?:combination |combo |combination[- ]play |combo[- ]play )?plays?\b/i
  );
  if (plays) return parseCountToken(plays[1]);
  const frames = String(message || '').match(/\b(\d+)\s+frames?\b/i);
  if (frames) return parseCountToken(frames[1]);
  return null;
}

export function inferStartFromFrame(message: string): number | null {
  const m =
    String(message || '').match(
      /\b(?:start(?:ing)?|begin(?:ning)?)\s+from\s+frame\s*(\d+)\b/i
    ) || String(message || '').match(/\bfrom\s+frame\s*(\d+)\b/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n >= 1 && n <= 20 ? n : null;
}

function mapBoardChannel(ch: BoardSetupReading['channel']): BoardAskChannel | null {
  if (ch === 'LEFT') return 'left';
  if (ch === 'RIGHT') return 'right';
  if (ch === 'CENTER') return 'central';
  return null;
}

export function inferAskChannel(
  message: string,
  board?: Pick<BoardSetupReading, 'channel'> | null
): BoardAskChannel | null {
  const t = String(message || '').toLowerCase();
  if (/\b(right)\s+(channel|side|wing|flank|half[-\s]?space)\b|\bon the right\b/.test(t)) {
    return 'right';
  }
  if (/\b(left)\s+(channel|side|wing|flank|half[-\s]?space)\b|\bon the left\b/.test(t)) {
    return 'left';
  }
  if (/\bcentral|center|centre|through the middle\b/.test(t)) return 'central';
  return mapBoardChannel(board?.channel ?? null);
}

function channelPhrase(ch: BoardAskChannel | null): string {
  if (ch === 'right') return 'the right side (bottom of the screen)';
  if (ch === 'left') return 'the left side (top of the screen)';
  if (ch === 'central') return 'the central channel';
  return 'the channel already on the board';
}

function reading(
  partial: Omit<BoardAskReading, 'n'> & { n: 1 | 2 | 3 }
): BoardAskReading {
  return partial;
}

export function wantsTacticalReadings(message: string): boolean {
  const t = String(message || '');
  if (isForceDrawRequest(t)) return false;
  return (
    /\b(readings?|interpretations?|best way|numbered)\b/i.test(t) ||
    /\b(give me|show me|offer)\s+(?:\d+|two|three|a few|some)\b/i.test(t) ||
    /\b(2 or 3|two or three)\b/i.test(t) ||
    /\bhow (?:else |(?:could|would|can|should) )(?:we |i |you )?(?:press|play out|build(?:[- ]?up)?|defend|attack)\b/i.test(
      t
    )
  );
}

function isPressAsk(message: string): boolean {
  return /\b(high press|press(?:ing)?|counterpress|gegenpress|press after)\b/i.test(message);
}

export function buildAskReadings(
  message: string,
  diagram: WebDiagramV1
): BoardAskReading[] {
  const board = readBoardSetup(diagram);
  const freezeAsked = wantsFrozenPlayers(message);
  const sequenceAsked = wantsSequenceFromMessage(message);
  const playOut = isPlayOutRequest(message);
  const playCount = inferPlayCountFromMessage(message);
  const startFrom = inferStartFromFrame(message);
  const channel = inferAskChannel(message, board);
  const side = channelPhrase(channel);

  if (wantsTacticalReadings(message) && isPressAsk(message)) {
    return [
      reading({
        n: 1,
        title: 'Jump the 6',
        summary: `First presser jumps their pivot. Cover the bounce on ${side}. Keep this roster.`,
        freezePlayers: false,
        reshape: false,
        sequence: false,
        playCount: null,
        channel,
        startFromFrame: null,
        intent: `High press: jump their #6 / pivot on ${side}. Keep roster ids. Step the block into their third (LEFT, y 0–33). Cover the bounce behind the first presser.`,
      }),
      reading({
        n: 2,
        title: 'Trap wide',
        summary: 'Show inside, force onto the touchline, press the receiver against the line.',
        freezePlayers: false,
        reshape: false,
        sequence: false,
        playCount: null,
        channel: channel || 'left',
        startFromFrame: null,
        intent: `High press trap wide: show inside, force onto the touchline, press the wide receiver. Keep roster ids. Compact the block in their third (LEFT).`,
      }),
      reading({
        n: 3,
        title: 'Squeeze the 9',
        summary: 'Curve the front to isolate their striker and force the goalkeeper back.',
        freezePlayers: false,
        reshape: false,
        sequence: false,
        playCount: null,
        channel,
        startFromFrame: null,
        intent: `High press: curve the front three to isolate their #9 / target. Force GK backwards. Keep roster ids. Block lives in their third (LEFT).`,
      }),
    ];
  }

  if (startFrom) {
    return [
      reading({
        n: 1,
        title: `Continue from Frame ${startFrom}`,
        summary: `Keep the filmstrip. Frame ${startFrom} is the start of the teaching detail. No extra “Start (board)” slide.`,
        freezePlayers: freezeAsked,
        reshape: false,
        sequence: true,
        playCount: playCount || 2,
        channel,
        startFromFrame: startFrom,
        intent: `Start from existing Frame ${startFrom}. Keep earlier frames. Add detailed teaching beats after it. Do not prepend another Start (board) frame.${freezeAsked ? ' Do not move shirts.' : ''}`,
      }),
      reading({
        n: 2,
        title: `Rebuild from Frame ${startFrom}`,
        summary: `Frame ${startFrom} becomes the new Start. Replace later slides with a fresh detailed sequence from that picture.`,
        freezePlayers: freezeAsked,
        reshape: false,
        sequence: true,
        playCount: playCount || 2,
        channel,
        startFromFrame: startFrom,
        intent: `Treat Frame ${startFrom} as the new Start. Rebuild a detailed teaching sequence from that snapshot. Do not add a duplicate Start frame.${freezeAsked ? ' Do not move shirts.' : ''}`,
      }),
      reading({
        n: 3,
        title: `Unpack Frame ${startFrom} into 3 beats`,
        summary: `Same picture, three sub-moments: receive, combine, finish. ${freezeAsked ? 'Shirts stay.' : 'Players can shift with the ball.'}`,
        freezePlayers: freezeAsked,
        reshape: false,
        sequence: true,
        playCount: 2,
        channel,
        startFromFrame: startFrom,
        intent: `Expand Frame ${startFrom} into receive / combine / finish beats. Frame 1 is that picture. No extra Start (board) frame.${freezeAsked ? ' Copy shirt x/y onto every frame.' : ''}`,
      }),
    ];
  }

  if (freezeAsked || playCount) {
    const nPlays = playCount || 3;
    return [
      reading({
        n: 1,
        title: freezeAsked
          ? `${nPlays} patterns, shirts frozen`
          : `${nPlays} patterns from this picture`,
        summary: `${nPlays} combination ideas on ${side}. Frame 1 = this board.${freezeAsked ? ' Shirts stay. Arrows and captions only.' : ' Players may move with each pattern.'}`,
        freezePlayers: freezeAsked,
        reshape: false,
        sequence: true,
        playCount: nPlays,
        channel,
        startFromFrame: null,
        intent: `Draw ${nPlays} combination plays on ${side}. Frame 1 is the current board unchanged.${freezeAsked ? ' Copy every shirt x/y onto every frame. Change only arrows, labels, and ball. No Initial Shape / reshape frame.' : ''} One combination per teaching frame.`,
      }),
      reading({
        n: 2,
        title: 'One detailed sequence',
        summary: `The strongest idea on ${side}, shown beat-by-beat (receive → combine → finish). ${freezeAsked ? 'Shirts stay.' : 'Players advance with the play.'}`,
        freezePlayers: freezeAsked,
        reshape: false,
        sequence: true,
        playCount: 2,
        channel,
        startFromFrame: null,
        intent: `Pick the strongest combination on ${side} and show it as one detailed sequence (Frame 1 = current board, then 3 teaching beats).${freezeAsked ? ' Do not move shirts.' : ''}`,
      }),
      reading({
        n: 3,
        title: freezeAsked ? 'Same patterns, supporting runs allowed' : 'Reshape, then the patterns',
        summary: freezeAsked
          ? `${nPlays} combinations on ${side}, but supporting players may move. Starters stay near their spots.`
          : `Clean the shape first, then show ${nPlays} combinations on ${side}.`,
        freezePlayers: false,
        reshape: !freezeAsked,
        sequence: true,
        playCount: nPlays,
        channel,
        startFromFrame: null,
        intent: freezeAsked
          ? `Draw ${nPlays} combinations on ${side}. Core starters stay close to the current picture; supporting runs may move. Frame 1 = current board. No extra Start frame.`
          : `Reshape to a legal setup for this phase, then draw ${nPlays} combination plays on ${side} as a sequence.`,
      }),
    ];
  }

  if (playOut) {
    return [
      reading({
        n: 1,
        title: 'Split CBs, 6 drops',
        summary: `Play out through a back three: CBs split, #6 drops between, first pass on ${side}.`,
        freezePlayers: false,
        reshape: false,
        sequence: true,
        playCount: 2,
        channel,
        startFromFrame: null,
        intent: `Play out from the current board. Split the centre-backs, #6 drops between them, first progression on ${side}. Honor DEF formation from the ask (e.g. 4-4-2). Frame 1 = current board, Frame 2 = the play.`,
      }),
      reading({
        n: 2,
        title: 'Wide fullback triangle',
        summary: 'Play out around the press through the fullback / wide mid triangle, then inside.',
        freezePlayers: false,
        reshape: true,
        sequence: true,
        playCount: 2,
        channel,
        startFromFrame: null,
        intent: `Reshape to a legal play-out vs the named opponent (honor 4-4-2 if asked). Play out wide through the fullback triangle on ${side}. Frame 1 start, Frame 2 the play.`,
      }),
      reading({
        n: 3,
        title: 'Bounce off the 8',
        summary: 'GK or CB into the 6, bounce into the 8, then progress through the pocket.',
        freezePlayers: false,
        reshape: false,
        sequence: true,
        playCount: 2,
        channel,
        startFromFrame: null,
        intent: `Play out from this picture: bounce off the #8 / pocket rather than the first wide pass. Honor DEF formation from the ask. Frame 1 = current, Frame 2 = the play.`,
      }),
    ];
  }

  return [
    reading({
      n: 1,
      title: 'Add it on this picture',
      summary: `Keep the shirts. Draw what you asked on ${side}${sequenceAsked ? ', as a short sequence' : ''} — arrows and captions. Frame 1 = this board.`,
      freezePlayers: !sequenceAsked,
      reshape: false,
      sequence: sequenceAsked,
      playCount: sequenceAsked ? 2 : null,
      channel,
      startFromFrame: null,
      intent: `Draw the coach’s ask on the current board on ${side}. Keep roster ids.${sequenceAsked ? ' Frame 1 = current board; later frames add the play.' : ' Prefer arrows and captions over moving the whole shape.'} Do not invent a different start.`,
    }),
    reading({
      n: 2,
      title: 'Teach it as a sequence',
      summary: 'Frame 1 = this board. Later slides show the play develop. Players can move with the ball.',
      freezePlayers: false,
      reshape: false,
      sequence: true,
      playCount: 2,
      channel,
      startFromFrame: null,
      intent: `Teach the ask as a sequence. Frame 1 = current board unchanged. Frame 2 shows the play on ${side}. Players may move with the ball. No extra Start frame.`,
    }),
    reading({
      n: 3,
      title: 'Reshape, then show the idea',
      summary: 'Reset to a clean legal shape for this phase, then draw the ask.',
      freezePlayers: false,
      reshape: true,
      sequence: sequenceAsked || playOut,
      playCount: sequenceAsked ? 2 : null,
      channel,
      startFromFrame: null,
      intent: `Reshape to a clean legal setup for this phase, then draw the coach’s ask on ${side}.`,
    }),
  ];
}

export function formatAskReadingsReply(input: {
  ask: string;
  readings: BoardAskReading[];
  board?: BoardSetupReading | null;
  diagram?: WebDiagramV1;
}): string {
  const asked = input.ask.replace(/\s+/g, ' ').trim().slice(0, 220);
  const fromAsk = inferFormationsFromMessage(input.ask);
  const playOut = isPlayOutRequest(input.ask);
  const named = [
    fromAsk.att || input.board?.attFormation
      ? `ATT ${fromAsk.att || input.board?.attFormation}`
      : null,
    fromAsk.def ? `DEF ${fromAsk.def}` : null,
  ]
    .filter(Boolean)
    .join(' vs ');
  const askOverlay =
    named || playOut
      ? `\nYou asked for ${named || 'this picture'}${playOut ? ' · playing out from the back' : ''}. Live shirts may still show the previous phase until you pick.`
      : '';
  const boardLine = askOverlay || (input.board?.summary ? `\n${input.board.summary}` : '');
  const items = input.readings
    .map((r) => `**${r.n}. ${r.title}**\n${r.summary}`)
    .join('\n\n');
  const parts = [
    `Here are 2–3 ways to play that — pick one.${boardLine}`,
    asked ? `You asked: “${asked}”` : null,
    items,
    ASK_READINGS_CTA,
  ].filter((line): line is string => Boolean(line));
  return scrubCoachReply(parts.join('\n\n'), input.diagram);
}

export function scrubCoachReply(text: string, diagram?: WebDiagramV1): string {
  let t = String(text || '')
    .replace(/\b(?:home|away)-\d+(?:-\d+)?\b/gi, (m) => {
      const n = m.split('-')[1];
      return n ? `#${n}` : m;
    })
    .replace(/\b(?:att|def)-(\d+)\b/gi, '#$1')
    .replace(/\bneutral(?:-auto)?-\d+\b/gi, 'a neutral')
    .replace(/\bBall @\(\s*[\d.]+\s*,\s*#?\s*[\d.]+\s*\)\.?/gi, '')
    .replace(/(?:with\s+)?\bseed set to current\b[,.]?/gi, '')
    .replace(/\(#(\d+)\s*,\s*#\1\)/g, '#$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const att = (diagram?.players || []).filter((p) => p.team === 'ATT').length;
  const def = (diagram?.players || []).filter((p) => p.team === 'DEF').length;
  if (att === 7 && def === 3) {
    t = t.replace(/\b7\s*v\s*7\b/gi, '7v3');
  }
  const format = diagram?.pitch?.format;
  if (format === '7V7') t = t.replace(/\b11\s*v\s*11\b/gi, '7v7');
  if (format === '9V9') t = t.replace(/\b11\s*v\s*11\b/gi, '9v9');
  const attNums = new Set(
    (diagram?.players || [])
      .filter((p) => p.team === 'ATT')
      .map((p) => p.number)
      .filter((n): n is number => typeof n === 'number')
  );
  if (diagram && !attNums.has(8)) {
    const cm = [6, 10, 4, 7, 11].find((n) => attNums.has(n));
    if (cm) {
      t = t
        .replace(/\binto (?:the |our |ATT |att )?(?:CM )?\#?8\b/gi, `into #${cm}`)
        .replace(/\b(?:ATT|att) \#8\b/g, `#${cm}`)
        .replace(/\b(?:attacking )?midfielder \#8\b/gi, `#${cm}`)
        .replace(/\bCM \#8\b/gi, `#${cm}`)
        .replace(/\b\#8 receives\b/gi, `#${cm} receives`)
        .replace(/\bbounce off the 8\b/gi, `bounce off the ${cm}`)
        .replace(/\bbounce into the 8\b/gi, `bounce into #${cm}`)
        .replace(/\binto \#8\b/gi, `into #${cm}`);
    }
  }
  if (diagram && /\bmid[- ]?block\b/i.test(t)) {
    t = t.replace(/\bour defensive (?:block|shape|unit)\b/gi, 'our mid-block');
  }
  t = t
    .replace(/\b(\d+)\s+pinks?\s*\/\s*(\d+)\s+blue\b/gi, '$1 blue / $2 red')
    .replace(/\b(\d+)\s+blue\s*\/\s*(\d+)\s+pinks?\b/gi, '$1 red / $2 blue')
    .replace(/\bthird_left\b/gi, 'their defensive third')
    .replace(/\bthird_middle\b/gi, 'the middle third')
    .replace(/\bthird_right\b/gi, 'our defensive third')
    .replace(/\bhalf_att\b/gi, 'our half')
    .replace(/\bssg_grid\b/gi, 'the grid');
  if (diagram && (diagram.players || []).length >= 14) {
    const setup = readBoardSetup(diagram);
    if (setup.attFormation && setup.defFormation && setup.attFormation !== setup.defFormation) {
      const esc = (f: string) => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      t = t
        .replace(
          new RegExp(`${esc(setup.defFormation)} formation for our`, 'gi'),
          `${setup.attFormation} shape for our`
        )
        .replace(
          new RegExp(`against their ${esc(setup.attFormation)}`, 'gi'),
          `against their ${setup.defFormation}`
        )
        .replace(new RegExp(`\\bour ${esc(setup.defFormation)}\\b`, 'gi'), `our ${setup.attFormation}`)
        .replace(new RegExp(`\\btheir ${esc(setup.attFormation)}\\b`, 'gi'), `their ${setup.defFormation}`)
        .replace(/\bour attacking unit\b/gi, `our ${setup.attFormation} block`)
        .replace(/\btheir attacking shape\b/gi, `their ${setup.defFormation}`);
      for (const f of ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2']) {
        if (f === setup.attFormation || f === setup.defFormation) continue;
        t = t.replace(new RegExp(`\\b${esc(f)}\\b`, 'g'), (match, offset: number, str: string) => {
          const before = str.slice(Math.max(0, offset - 28), offset).toLowerCase();
          if (/\b(their|them|def|opposition|away)\b/.test(before)) return setup.defFormation!;
          if (/\b(our|us|att|attacking)\b/.test(before)) return setup.attFormation!;
          return setup.defFormation!;
        });
      }
    }
  }
  const nFrames = diagram?.sequence?.frames?.length || 0;
  if (nFrames >= 1) {
    t = t
      .replace(/\bSlide (\d+)\b/gi, (_m, n) =>
        Number(n) > nFrames ? `Slide ${nFrames}` : `Slide ${n}`
      )
      .replace(/\b(?:a )?sequence of \d+ (?:teaching )?frames?\b/gi, `${nFrames}-frame strip`)
      .replace(/\b\d+-slide\b/gi, `${nFrames}-frame`)
      .replace(/\b(?:four|4)[- ]frames?\b/gi, nFrames === 1 ? '1-frame' : `${nFrames}-frame`)
      .replace(/\b(?:four|4) slides?\b/gi, nFrames === 1 ? '1 frame' : `${nFrames} frames`);
  }
  const shirts = diagram?.players || [];
  const neu = shirts.filter((p) => p.team === 'NEUTRAL').length;
  const ssg = (diagram?.areas || []).some((a) => /ssg/i.test(String(a.label || '')));
  const rondo = (diagram?.areas || []).some((a) => /rondo/i.test(String(a.label || '')));
  if ((ssg || rondo || neu >= 2) && shirts.length >= 6 && shirts.length <= 16) {
    const fmt = (team: 'ATT' | 'DEF' | 'NEUTRAL') =>
      shirts
        .filter((p) => p.team === team)
        .map((p) =>
          p.number === 1 || String(p.role || '').toUpperCase() === 'GK' ? 'GK' : `#${p.number}`
        )
        .join('/');
    const neuBit = neu ? ` · ${neu} amber (${fmt('NEUTRAL')})` : '';
    const line = `On the grass: ${att} blue (${fmt('ATT')}) · ${def} red (${fmt('DEF')})${neuBit}.`;
    if (!/On the grass:/i.test(t)) t = `${t}\n\n${line}`;
    t = t.replace(
      /\b\d+\s*ATT\s*\+\s*\d+\s*DEF(?:\s*\+\s*\d+\s*neutrals?)?\b/gi,
      neu ? `${att} ATT + ${def} DEF + ${neu} neutrals` : `${att} ATT + ${def} DEF`
    );
  }
  return t;
}

export function needsAskReadings(input: {
  message: string;
  history: BoardAiChatMessage[];
  diagram: WebDiagramV1;
}): boolean {
  const { message, history } = input;
  if (isTinyBoardOp(message)) return false;
  const offered = assistantOfferedAskReadings(history);
  const picked = parsePickedReadingIndex(message);
  if (offered && (picked || isForceDrawRequest(message))) return false;
  if (isForceDrawRequest(message)) return false;
  if (!offered && picked) return false;
  return wantsTacticalReadings(message);
}

export function messageWithReadingLocks(ask: string, chosen: BoardAskReading): string {
  const bits = [ask.trim(), `LOCKED READING ${chosen.n}: ${chosen.intent}`];
  if (chosen.freezePlayers) {
    bits.push('without moving any players, keep shirts as they are, freeze positions');
  }
  if (!chosen.reshape) {
    bits.push('do not reshape; start from the current board');
  } else {
    bits.push('you may reshape the setup for this reading');
  }
  if (chosen.sequence) {
    bits.push(
      chosen.playCount && chosen.playCount > 2
        ? `show a sequence of ${chosen.playCount} teaching frames after the start`
        : 'Frame 1 is the start picture; Frame 2 is the play'
    );
  }
  if (chosen.channel) bits.push(`on the ${chosen.channel} side`);
  if (chosen.startFromFrame) {
    bits.push(
      `start from Frame ${chosen.startFromFrame}, do not add a duplicate Start (board) frame`
    );
  }
  return bits.join('. ');
}

/** Coach is asking about / continuing from the picture already on the board. */
export function isBoardReferencingRequest(message: string): boolean {
  return /\b(look(?:ing)? at (?:the )?board|on (?:the )?board|from (?:here|there|this)|current (?:setup|board|picture|shape|positions?)|as (?:shown|drawn|set up|set)|from this (?:position|setup|shape|picture)|move from there|starting from (?:here|this|the board)|based on (?:the |this )?board|using (?:the |this )?board|what(?:'s| is) on the board|read the board)\b/i.test(
    message
  );
}

export type BoardSetupReading = {
  usable: boolean;
  attFormation: string | null;
  defFormation: string | null;
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
  const frames = diagram.sequence?.frames;
  const active =
    frames?.find((f) => f.id === diagram.sequence?.activeFrameId) || frames?.[frames.length - 1];
  const preferred =
    active && !isStartLikeFrame(active) ? active : frames?.[frames.length - 1] || active;
  const live: WebDiagramV1 = preferred
    ? {
        ...diagram,
        players: preferred.players?.length ? preferred.players : diagram.players,
        areas: preferred.areas?.length ? preferred.areas : diagram.areas,
        labels: preferred.labels?.length ? preferred.labels : diagram.labels,
        balls: preferred.balls?.length ? preferred.balls : diagram.balls,
        arrows: preferred.arrows?.length ? preferred.arrows : diagram.arrows,
        sequence: diagram.sequence
          ? { ...diagram.sequence, activeFrameId: preferred.id }
          : diagram.sequence,
      }
    : diagram;

  const players = live.players || [];
  const attOut = players.filter((p) => p.team === 'ATT' && p.number !== 1);
  const defOut = players.filter((p) => p.team === 'DEF' && p.number !== 1);
  const usable = attOut.length >= 4 && defOut.length >= 4;
  const card = summarizeBoardCardMeta(live);

  const attFormation = card.attFormation || inferFormationForTeam(players, 'ATT');
  const defFormation = card.defFormation || inferFormationForTeam(players, 'DEF');

  const labelText = (live.labels || []).map((l) => l.text || '').join(' · ');
  const areaText = (live.areas || []).map((a) => a.label || '').join(' · ');
  const intent = String(live.areas?.[0]?.label || '').toLowerCase();
  const hasPress = (live.arrows || []).some((a) => String(a.type || '').toLowerCase() === 'press');
  const phase =
    intent === 'rondo' || /rondo/.test(areaText)
      ? 'Possession · rondo'
      : intent === 'ssg_grid' || /ssg/.test(areaText)
        ? 'Possession · small-sided'
        : hasPress || intent === 'third_left'
          ? 'Defensive Organization · high press'
          : intent === 'third_middle' || /\bmid[- ]?block\b/i.test(`${labelText} ${areaText}`)
            ? 'Defensive Organization · mid-block'
            : phaseFromBoardText(`${labelText} ${areaText}`) ||
              (usable
                ? (() => {
                    const ball = live.balls?.[0];
                    const y =
                      ball && typeof ball.y === 'number'
                        ? ball.y
                        : live.areas?.[0] && typeof live.areas[0].y === 'number'
                          ? live.areas[0].y + (live.areas[0].height || 0) / 2
                          : null;
                    if (y == null) return 'Attacking Organization (from board shape)';
                    const third = thirdFromY(y);
                    if (third === 'DEFENSIVE') return 'Attacking Organization · build-up';
                    if (third === 'ATTACKING') return 'Attacking Organization · final third';
                    return 'Attacking Organization · progression';
                  })()
                : null);

  const focusY = (() => {
    const area = live.areas?.[0];
    if (area && typeof area.y === 'number' && intent && intent !== 'full_pitch') {
      return area.y + (area.height || 0) / 2;
    }
    const ball = live.balls?.[0];
    if (ball && typeof ball.y === 'number') return ball.y;
    if (area && typeof area.y === 'number') return area.y + (area.height || 0) / 2;
    if (attOut.length) {
      return attOut.reduce((s, p) => s + p.y, 0) / attOut.length;
    }
    return null;
  })();
  const focusX = (() => {
    const area = live.areas?.[0];
    if (area && typeof area.x === 'number' && intent && intent !== 'full_pitch') {
      return area.x + (area.width || 0) / 2;
    }
    const ball = live.balls?.[0];
    if (ball && typeof ball.x === 'number') return ball.x;
    if (area && typeof area.x === 'number') return area.x + (area.width || 0) / 2;
    return 50;
  })();

  const focusThird = focusY == null ? null : thirdFromY(focusY);
  const channel = focusY == null ? null : channelFromX(focusX);

  const attN = players.filter((p) => p.team === 'ATT').length;
  const defN = players.filter((p) => p.team === 'DEF').length;
  const neuN = players.filter((p) => p.team === 'NEUTRAL').length;
  const summaryParts = [
    usable
      ? `Board has ${attN} ATT + ${defN} DEF${neuN ? ` + ${neuN} neutrals` : ''} shirts.`
      : 'Board lineup is thin / incomplete.',
    attFormation || defFormation
      ? `Inferred formations: ATT ${attFormation || '?'} vs DEF ${defFormation || '?'}.`
      : 'Formations not confidently inferred from roles — keep shirts as drawn.',
    phase ? `Phase from board: ${phase}.` : null,
    focusThird
      ? `Focus in ${focusThird === 'DEFENSIVE' ? 'our defensive third (RIGHT)' : focusThird === 'ATTACKING' ? 'our attacking third (LEFT)' : 'middle third'}${channel ? ` · ${channel.toLowerCase()} channel` : ''}.`
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
    /\b(mid[- ]?block|high press|low block|rondo|press(?:ing)? in)\b/i.test(text) ||
    /\bphase\b[\s\S]{0,30}\b(attack|defend|transition|possession)\b/i.test(text)
  );
}

export type ScenarioGaps = {
  missingFormation: boolean;
  missingChannel: boolean;
  missingPhase: boolean;
};

function livePlayerCount(diagram?: WebDiagramV1 | null): number {
  if (!diagram) return 0;
  if ((diagram.players || []).length) return diagram.players.length;
  const frames = diagram.sequence?.frames || [];
  const active =
    frames.find((f) => f.id === diagram.sequence?.activeFrameId) || frames[frames.length - 1];
  return active?.players?.length || 0;
}

export function assessScenarioGaps(
  message: string,
  history: BoardAiChatMessage[] = [],
  diagram?: WebDiagramV1 | null
): ScenarioGaps {
  const blob = conversationBlob(message, history);
  const board = diagram ? readBoardSetup(diagram) : null;
  // Live board with both teams can supply formations + phase — don't re-ask.
  const boardUsable = Boolean(board?.usable);
  const liveRoster = livePlayerCount(diagram) >= 5;
  const formatKnown = Boolean(diagram?.pitch?.format);
  return {
    missingFormation: !hasFormationDetail(blob) && !boardUsable && !formatKnown && !liveRoster,
    missingChannel: !hasChannelDetail(blob) && !board?.channel,
    missingPhase: !hasPhaseDetail(blob) && !boardUsable && !liveRoster,
  };
}

export function needsBoardClarification(
  message: string,
  history: BoardAiChatMessage[] = [],
  diagram?: WebDiagramV1 | null
): boolean {
  if (isForceDrawRequest(message)) return false;
  // Direct board ops / tiny edits don't need a full scenario brief
  if (isTinyBoardOp(message)) {
    return false;
  }
  // Usable live board already encodes formations + phase/focus — read it instead of clarifying
  if (diagram && (readBoardSetup(diagram).usable || livePlayerCount(diagram) >= 5)) {
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
  lockedReading?: BoardAskReading | null;
  hasImage?: boolean;
  sourceDiagramMode?: 'first' | 'all' | 'named' | null;
  importReview?: boolean;
  importAnswers?: ImportReviewAnswers | null;
  symbolicDsl?: boolean;
}): string {
  const historyBlock =
    input.history.length === 0
      ? '(none)'
      : input.history
          .slice(-8)
          .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
          .join('\n');

  const playerIndex =
    input.symbolicDsl && !input.importReview
      ? compactRosterForDsl(input.diagram)
          .players.map((p) => `${p.id} (#${p.number ?? '?'} ${p.role || p.team})`)
          .join('\n') || '(no players yet)'
      : formatBothTeamsPlayerIndex(input.diagram);
  const sequenceTeamBrief =
    input.symbolicDsl && !input.importReview ? '' : formatSequenceBothTeamsBrief(input.diagram);
  const boardReading = readBoardSetup(input.diagram);

  const focusHint = inferFocusThirdFromMessage(input.message);
  const formationPlaybookGuidance = buildFormationPlaybookGuidance(
    conversationBlob(input.message, input.history),
    { att: toFormationId11(boardReading.attFormation), def: toFormationId11(boardReading.defFormation) }
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
        input.lockedReading
          ? `- The coach already picked reading ${input.lockedReading.n}. Set apply=true and draw THAT reading only — do not offer new options.`
          : '- Do not invent extra Start / Initial Shape slides. Frame 1 is the current board.',
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
    input.lockedReading
      ? [
          `LOCKED READING (coach picked option ${input.lockedReading.n} — draw THIS, do not reinterpret):`,
          `- Title: ${input.lockedReading.title}`,
          `- Intent: ${input.lockedReading.intent}`,
          `- Freeze shirts: ${input.lockedReading.freezePlayers ? 'YES — copy current x/y onto every frame' : 'no — players may move with the play'}`,
          `- Reshape: ${input.lockedReading.reshape ? 'allowed' : 'NO — keep the current picture as Frame 1'}`,
          `- Sequence: ${input.lockedReading.sequence ? `YES (${input.lockedReading.playCount || 3} teaching frames after start)` : 'only if needed'}`,
          input.lockedReading.channel
            ? `- Channel: ${input.lockedReading.channel}`
            : null,
          input.lockedReading.startFromFrame
            ? `- Start from Frame ${input.lockedReading.startFromFrame}. Do not prepend another Start (board) frame.`
            : null,
          '- Set apply=true and return the full diagram for this reading only.',
        ]
          .filter(Boolean)
          .join('\n')
      : '',
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
    '- “Us” on this board = ATT (blue / home), own goal RIGHT. “Them” = DEF (red / away), own goal LEFT.',
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
    '- The CURRENT BOARD format is authoritative. Never emit format 11V11 or 4-3-3/4-4-2 on a 7v7/9v9 board. Never say “11v11” in reply unless the board is 11v11.',
    '',
    'DIAGRAM RULES:',
    input.symbolicDsl && !input.importReview
      ? [
          '- Do NOT emit x, y, or a diagram object. Geometry is solved in code from your dsl.',
          '- players ids like att-9 / def-6. Never duplicate shirts.',
          '- Traditional numbers: 1 GK, 2 RB, 3 LB, 4/5 CB, 6 holding, 7/11 wide, 8/10 CM, 9 ST.',
          '- actions[].from_id / to_id must be those ids (att-6, def-9).',
          '- equipment[] for mini-goal, cone, mannequin, pole — never fake kit as players.',
        ].join('\n')
      : [
          '- Return a FULL diagram object every time you apply changes (not a patch).',
          '- When apply=false, still return the CURRENT diagram unchanged.',
          '- Keep pitch.orientation = "HORIZONTAL".',
          '- players: team ATT|DEF only (avoid NEUTRAL). ids like att-9 / def-6. Never create duplicate shirts (one #5 ATT max).',
        ].join('\n'),
    ...(input.symbolicDsl && !input.importReview
      ? [
          '- Traditional numbers: 1 GK, 2 RB, 3 LB, 4/5 CB, 6 holding, 7/11 wide, 8/10 CM, 9 ST.',
          '- Match reply vocabulary to the COACH / PLAYER LANGUAGE LOCK and club play model.',
          '- Passes/runs/press: actions[] with from_id/to_id (att-3, att-7). Never coordinates.',
          '- If a 4-4-2 jumps the 6, bounce into att-8 — never pass into the jumped att-6.',
          '- “the 9’s run” / “9s run in behind” → run from_id MUST be att-9 (not att-10).',
          '- Never write seed/dsl internals, “seed set to current”, or doubled labels like (#6, #6).',
          '- Us is always blue ATT. Opponent / OOP shape is “their 4-4-2” or “a 4-4-2 block”, not “our 4-4-2”, unless blue shirts are that shape.',
          '- Equipment: equipment[] (mini-goal, cone, mannequin, pole). Never fake kit as players.',
          '- Sequence / freeze: describe it in reply. Do not emit diagram.sequence or x/y. seed=current; freeze → empty moves[].',
          '- Play-out / build-out: grid.intent box_att or half_att; moves for the pressers (press:att-*). Code may add frames.',
          '- Both teams: include ATT and DEF entities (or seed=current so the live roster stays).',
          '',
        ]
      : [
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
          '- elements: practice kit. kind mini-goal | cone | mannequin | pole. x/y 0–100. Mini-goal rotation 0 = mouth faces +y (RIGHT / our goal).',
          '- Put every visible mini-goal, cone, pole, and mannequin in elements[]. Do not fake them as players or omit them.',
          '- Max PER FRAME: 30 players, 40 arrows, 20 areas, 20 labels, 40 elements.',
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
          ...((input.lockedReading?.freezePlayers ?? wantsFrozenPlayers(input.message))
            ? [
                'PLAYER FREEZE (mandatory this turn — coach forbade moving shirts):',
                '- Copy CURRENT DIAGRAM players[] onto EVERY frame with the SAME id, x, y, team, role, number.',
                '- Exception: if they named one shirt to drop/tuck (“drop the 8 without moving anyone else”), freeze everyone else and move THAT ATT shirt toward our goal (higher y).',
                '- Do NOT add an “Initial Shape” / reshape / setup frame.',
                '- Teaching frames may change ONLY arrows, labels, optional ball, optional highlight — never shirt coordinates.',
                '- If they asked for N combination plays: Frame 1 = saved board; Frames 2..N+1 = one combination each (pass + support-run arrows on the named side).',
                '- Right side on this board = low diagram x (bottom of screen).',
                '',
              ]
            : []),
          'SEQUENCE CONTINUITY (mandatory):',
          '- Frame 1 locks the coach’s board photo (formations, channel, player ids/positions) — never invent a different start.',
          '- The PLAY MUST ADVANCE across frames 2+ (do not freeze the highlight on Frame 1’s third).',
          '  Typical build-out: Frame 1 saved board → Frame 2 midfield pocket / half-space → Frame 3 wide progression / final third.',
          '- Move the ball + highlight with the phase on teaching frames. Structure players shift gradually (≤ ~18 units from Frame 1) unless they are in the action.',
          '- Frames 2–N need MORE detail than Frame 1: involve 6–10 players in the picture (CBs, #6/#8, fullbacks/wing-backs, wingers, pressers).',
          '- Frame 2 is the first teaching beat — NEVER a thinner copy of Frame 1.',
          '  Density target: 6–8 arrows (pass + support runs + DEF press/cover), 2 captions, 1–2 zones.',
          '  Involve shirts from BOTH teams: e.g. ATT #4/#6/#8/#2/#3/#7 plus DEF #9/#10/#8/#6 in/around the pocket.',
          '  Captions must name the teaching action (pocket receive, third-man, press jump) — do not reuse a generic Frame 1 sentence.',
          '- Never stack players — including opposite colours (ATT vs DEF). Shirt centers must stay ≥8 units apart so no shirt hides another.',
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
        ]),
    'OUTPUT: ONLY a JSON object (no markdown prose outside JSON):',
    input.symbolicDsl && !input.importReview
      ? [
          '{',
          '  "reply": "What I saw\\n- ...\\n\\nOn the board\\n- ...\\n\\nCoaching points\\n- ...",',
          '  "apply": true|false,',
          '  "dsl": {',
          '    "activity": "rondo"|"match_scenario"|"technical_exercise"|"scrimmage",',
          '    "seed": "current"|"formation"|"blank",',
          '    "grid": { "intent": "...", "format": "7V7"|"9V9"|"11V11", "attFormation": "4-3-3"|..., "defFormation": "..." },',
          '    "entities": [{ "id":"att-6", "team":"ATT", "number":6, "relative_position":"own_6"|"perimeter"|"inside"|"own_gk"|"own_line"|"grid_c"|... }],',
          '    "equipment": [{ "kind":"mini-goal"|"cone"|"mannequin"|"pole", "placement":"grid_e", "quantity":1 }],',
          '    "actions": [{ "type":"pass"|"run"|"press"|"cover"|"transition", "from_id":"att-6", "to_id":"att-10" }],',
          '    "moves": [{ "id":"def-9", "to":"press:att-6"|"keep"|"toward_ball"|"inside" }]',
          '  }',
          '}',
          '',
          'SYMBOLIC DSL (mandatory — the solver places shirts):',
          '- NEVER include "diagram", x, or y. If you emit coordinates the apply is rejected.',
          '- grid.intent: full_pitch | half_att | half_def | third_left | third_middle | third_right | box_att | box_def | rondo | ssg_grid',
          '- 7v7 formations: 2-3-1, 3-2-1. 9v9: 3-2-3, 2-3-2-1, 3-3-2. 11v11: 4-3-3, 4-2-3-1, 4-4-2, 3-5-2.',
          '- seed=current when the board already has shirts and this is a continuation / “from this” / freeze (empty moves).',
          '- seed=formation for a new 11v11 / Q3 B. seed=blank for rondo, SSG, function, import-as-written.',
          '- Do not pad a rondo/function to 22 shirts. activity rondo|technical_exercise + seed blank + entities only.',
          '- third_left = their defensive / our attacking third. third_right = our defensive third.',
          '- Us = ATT blue, own goal RIGHT. Use own_gk / own_line — never a touchline GK.',
        ].join('\n')
      : [
          '{',
          '  "reply": "What I saw\\n- ...\\n\\nOn the board\\n- ...\\n\\nCoaching points\\n- ...",',
          '  "apply": true|false,',
          '  "diagram": { ...full WebDiagramV1, optionally with sequence.frames[...]... }',
          '}',
        ].join('\n'),
    '',
    'REPLY FORMAT (mandatory — put real newline characters inside the JSON string):',
    '- Do NOT write one dense paragraph.',
    '- Use short labelled sections, then bullets. Headings on their own line. Bullets start with "- ".',
    '- Default sections (skip a section if it has nothing useful):',
    '  What I saw',
    '  On the board',
    '  Coaching points',
    '- Photo/PDF: What I saw = what the file showed; On the board = how you redrew it (shirts, zone, arrows); Coaching points = 3–5 teachable cues.',
    '- Sequences: under On the board, one bullet per slide (Slide 1 / 2 / 3 — who moves, which shirts).',
    '- Shirt numbers once: write #6, never (#6, #6). Never mention seed, dsl, freeze flags, or “set to current”.',
    '- Us is always blue ATT. Call the opponent’s shape “their 4-4-2” / “a 4-4-2 block”, not “our 4-4-2”, unless the blue shirts are actually that shape.',
    '- 6–12 bullets total. One idea per bullet. Never truncate mid-thought.',
    '- Photo/PDF first turn: What I saw only (no guessing). Do not include On the board, Coaching points, or questions.',
    '- Photo/PDF after answers: What I saw / On the board / Coaching points.',
    '',
    `Age group context: ${input.ageGroup || 'unknown'}`,
    `Game model id: ${input.gameModelId || 'unknown'}`,
    ...((input.lockedReading?.sequence ?? wantsSequenceFromMessage(input.message))
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
    input.symbolicDsl && !input.importReview
      ? JSON.stringify(compactRosterForDsl(input.diagram))
      : JSON.stringify(compactDiagram(input.diagram)),
    '',
    input.hasImage
      ? input.importReview
        ? [
            'IMPORT REVIEW (mandatory this turn — DO NOT DRAW):',
            '- apply=false. Return the CURRENT diagram unchanged.',
            '- Review the file. What I saw = only what is visible (title, area, numbers, diagrams). If something is unclear, say unclear — do not invent 11v11, floaters, or a chassis.',
            '- Count how many separate pitch diagrams are in the file.',
            '- First bullet of What I saw MUST be Organisation: NvM + GK/neutrals — count every numbered shirt on the first diagram (7v6+GK is 7+6+keeper, not a 4v4 inside it). Waiting defenders outside a grid still count (5 inside vs 1 hunter + 4 waiters = 5v5, not 5v1+4 floaters).',
            '- Reply is What I saw only. Do NOT include On the board, Coaching points, or any questions — questions are appended for you.',
            '- Do not pick A/B/C. Do not offer 1/2/3 readings.',
          ].join('\n')
        : [
            'UPLOADED TACTICAL FILE (mandatory this turn — photo or PDF):',
            input.importAnswers ? formatImportLocks(input.importAnswers) : null,
            '- DECODE the source: area size, player numbers, mini-goals, floaters, overload, arrows, captions.',
            input.importAnswers?.draw === 'eleven'
              ? '- The coach chose 11v11: scale the same idea onto a full match board. Still do not invent a different session.'
              : '- DRAW THE PRACTICE AS WRITTEN. Do NOT translate a function / SSG / rondo / 6v3 into a full 11v11 match picture.',
            '- Replace the current board with the source practice. Do not keep leftover shirts from the live board unless they match the source.',
            '- Keep the organisation from the file: boxed area, named numbers, mini-goals, floaters, overload. Only draw 11v11 if the source is 11v11 OR the coach chose Q3 B.',
            '- Count every numbered shirt. 7v6 means 7 + 6 (plus a GK if the file shows one), never 7+4. Same numbers keep their source colour: if 4 and 8 are on the attacking kit, they stay DEF (red) when we are the defending unit.',
            input.importAnswers?.us === 'attackers'
              ? '- Us = ATT (blue), own goal RIGHT = the attacking side in the session. Them = DEF (red) facing us.'
              : input.importAnswers?.us === 'labelled'
                ? '- Keep source labels, but still map the coached team’s own goal to RIGHT if they are the defending unit, or LEFT if they are attacking a full goal on the left.'
                : '- Us = ATT (blue), own goal RIGHT. If this is a defending function, we are STILL blue — we stand in OUR defensive third (RIGHT, y≈70–95) in a defending shape. Opposition attackers are DEF (red) in front of us (lower y), attacking toward our goal (toward RIGHT). NEVER paint the coached back line as red on the right.',
            '- Paper “own goal / defending end / back 3 protecting the box” → RIGHT (y high). Paper “attacking end / mini-goal they score into after regain” → away from our goal (lower y), mouth facing the coached team (rotation 0 unless the source faces the other way).',
            '- Emit elements[] for every mini-goal, cone, pole, and mannequin in the file. Cones mark the boxed area corners. Mini-goals are elements kind "mini-goal", not players. Four mini-goals (one per side) → equipment grid_n / grid_e / grid_s / grid_w.',
            '- Club game-model language belongs in Coaching points only unless they chose 11v11.',
            '- Translate onto this HORIZONTAL board (goals LEFT/RIGHT). Do not copy photo/PDF pixel axes.',
            '- ORIENTATION LOCK: a back 3 protecting a goal is a line PARALLEL TO THE GOAL (vertical on screen — varied x, similar y). GK at the RIGHT goal = y≈92, x≈50. NEVER put the GK on the top/bottom touchline (that is x≈5 or x≈95). Paper “up the page” becomes RIGHT on this board when we are defending our third.',
            input.sourceDiagramMode === 'all'
              ? '- Draw EVERY source diagram. One sequence frame per diagram. Title frames from the source. Do NOT prepend a “Start (board)” 11v11 slide.'
              : input.sourceDiagramMode === 'named'
                ? `- Draw ONLY this picture: ${input.importAnswers?.namedHint || 'the one the coach named'}.`
                : '- Draw ONLY the first tactical diagram in the file.',
            input.symbolicDsl
              ? '- apply=true. Return dsl (no diagram x/y) that matches the source + locked answers. seed=blank unless they chose 11v11 (then seed=formation).'
              : '- apply=true. Return a FULL diagram that matches the source + locked answers.',
            '- If the typed request conflicts with the file, obey the typed request.',
          ]
            .filter(Boolean)
            .join('\n')
      : '',
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
  image?: BoardChatImage | null;
}): Promise<BoardAiChatResult> {
  const audience = resolveBoardAudience({
    coachLevel: input.coachLevel,
    ageGroup: input.ageGroup,
  });
  const resultBase = {
    coachLevel: audience.coachLevel,
    playerLevel: audience.playerLevel,
  };

  const hasImage = Boolean(input.image?.data);
  const message = String(input.message || '').trim()
    || (hasImage
      ? isBoardChatPdf(input.image?.mimeType)
        ? 'Recreate this tactical PDF on the board.'
        : 'Recreate this tactical picture on the board.'
      : '');
  if (!message) {
    return {
      ...resultBase,
      reply: 'Tell me what scenario you want on the board, or attach a photo or PDF of a tactical picture.',
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

  const history = historyWithoutCurrentTurn(
    Array.isArray(input.history) ? input.history.slice(-12) : [],
    message
  );
  const gaps = assessScenarioGaps(message, history, input.diagram);
  const improveAsk = isSessionImproveRequest(message);
  // Training/vault asks don't need a fresh draw — use what's already on the board.
  // An uploaded picture supplies formations/phase — don't re-ask, and skip numbered readings.
  const clarifyRequired = improveAsk || hasImage
    ? false
    : needsBoardClarification(message, history, input.diagram);
  const playModel = await resolveBoardPlayModelContext({
    gameModelId: input.gameModelId,
    clubId: input.clubId,
  });
  const playModelGuidance = buildBoardPlayModelGuidance(playModel);
  const languageGuidance = buildBoardLanguageGuidance(audience);

  if (improveAsk && !hasImage) {
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

  const offeredReadings = assistantOfferedAskReadings(history);
  const offeredSourceDiagrams = assistantOfferedSourceDiagrams(history);
  const offeredImportReview = assistantOfferedImportReview(history);
  const importAnswersRaw = parseImportReviewAnswers(message);
  const importAnswers =
    importAnswersRaw && (hasImage || offeredImportReview) ? importAnswersRaw : null;
  const drawAllSourceDiagrams = wantsAllSourceDiagrams(message, history);
  const importReview =
    Boolean(hasImage && !isImportJustDraw(message) && !importAnswers);
  const sourceDiagramMode: 'first' | 'all' | 'named' | null = !hasImage
    ? null
    : importAnswers?.pictures === 'all' || drawAllSourceDiagrams
      ? 'all'
      : importAnswers?.pictures === 'named'
        ? 'named'
        : 'first';

  if (offeredImportReview && !importAnswers && !isImportJustDraw(message) && !hasImage) {
    return {
      ...resultBase,
      reply: 'I won’t guess. Reply **A A A** (pictures · us · draw), or **just draw it**.',
      applied: false,
      diagram: input.diagram,
    };
  }

  if (importAnswers && !hasImage) {
    return {
      ...resultBase,
      reply: 'Attach the PDF or photo again with those answers and I’ll draw it.',
      applied: false,
      diagram: input.diagram,
    };
  }

  if (drawAllSourceDiagrams && offeredSourceDiagrams && !hasImage) {
    return {
      ...resultBase,
      reply: 'Attach the PDF or photo again and say **all** — I’ll put each diagram on its own frame.',
      applied: false,
      diagram: input.diagram,
    };
  }

  const pickedIndex = parsePickedReadingIndex(message);
  if (!hasImage && !offeredReadings && pickedIndex && !offeredSourceDiagrams) {
    return {
      ...resultBase,
      reply: 'Tell me the scenario first — then I’ll offer 1 / 2 / 3 ways to draw it.',
      applied: false,
      diagram: input.diagram,
    };
  }

  const originalAsk = collectCoachAsk(message, history);
  const readings = buildAskReadings(originalAsk, input.diagram);
  if (
    !hasImage &&
    !improveAsk &&
    !offeredImportReview &&
    needsAskReadings({ message, history, diagram: input.diagram })
  ) {
    return {
      ...resultBase,
      reply: formatAskReadingsReply({
        ask: originalAsk,
        readings,
        board: readBoardSetup(input.diagram),
        diagram: input.diagram,
      }),
      applied: false,
      diagram: input.diagram,
    };
  }

  const lockedReading =
    offeredReadings && pickedIndex
      ? readings[pickedIndex - 1] || readings[0]
      : offeredReadings && isForceDrawRequest(message)
        ? readings[0]
        : null;
  const drawMessage = lockedReading
    ? messageWithReadingLocks(originalAsk, lockedReading)
    : originalAsk;

  const prompt = buildPrompt({
    diagram: input.diagram,
    message: drawMessage,
    history,
    ageGroup: input.ageGroup,
    gameModelId: playModel.gameModelId || input.gameModelId,
    playModelGuidance,
    languageGuidance,
    clarifyRequired: false,
    gaps,
    lockedReading,
    hasImage,
    sourceDiagramMode,
    importReview,
    importAnswers,
    symbolicDsl: boardSymbolicDslEnabled() && !importReview,
  });

  setMetricsContext({
    operationType: hasImage ? 'board_ai_image' : 'board_ai_chat',
    ageGroup: input.ageGroup || undefined,
    gameModelId: playModel.gameModelId || input.gameModelId || undefined,
  });

  const boardModel = process.env.GEMINI_BOARD_AI_MODEL || process.env.GEMINI_FAST_MODEL;
  const symbolicDsl = boardSymbolicDslEnabled() && !importReview;
  const jsonMime = symbolicDsl ? 'application/json' : undefined;
  let text = '';
  try {
    text = hasImage && input.image
      ? await generateMultimodalText(
          [
            { text: prompt },
            { inlineData: { mimeType: input.image.mimeType, data: input.image.data } },
          ],
          {
            timeout: 90000,
            model: boardModel,
            maxOutputTokens: 16384,
            responseMimeType: jsonMime,
          }
        )
      : await generateText(prompt, {
          timeout: 90000,
          retries: 1,
          model: boardModel,
          maxOutputTokens: 16384,
          responseMimeType: jsonMime,
        });
  } finally {
    clearMetricsContext();
  }

  const parsed = parseJsonObject(text);
  if (!parsed || typeof parsed !== 'object') {
    return {
      ...resultBase,
      reply: importReview
        ? ensureImportReviewQuestions(
            'I read the file but couldn’t format the review. Here’s what I still need before I draw:'
          )
        : hasImage
          ? "I couldn't turn that file into a board. Try a clearer photo or PDF of the pitch, or add a short caption (e.g. “433 vs 442 press after loss”)."
          : "I couldn't format a board update. Try a clearer scenario (e.g. “7v7 ATT 2-3-1 vs DEF 3-2-1, central channel, Defensive Transition — press after loss in their defensive third”).",
      applied: false,
      diagram: input.diagram,
    };
  }

  const reply =
    typeof parsed.reply === 'string' && parsed.reply.trim()
      ? parsed.reply.trim().slice(0, 6000)
      : 'Updated the board.';
  const apply = parsed.apply !== false;

  if (importReview) {
    return {
      ...resultBase,
      reply: ensureImportReviewQuestions(reply),
      applied: false,
      diagram: input.diagram,
    };
  }

  // Safety: never apply if gaps reappear (e.g. new vague turn after history reset)
  if (
    apply &&
    !lockedReading &&
    !hasImage &&
    needsBoardClarification(drawMessage, history, input.diagram)
  ) {
    return {
      ...resultBase,
      reply: buildClarifyingReply({
        gaps: assessScenarioGaps(drawMessage, history, input.diagram),
        gameModelId: playModel.gameModelId || input.gameModelId,
        ageGroup: input.ageGroup,
        clubName: playModel.clubName,
      }),
      applied: false,
      diagram: input.diagram,
    };
  }

  if (!apply) {
    return { ...resultBase, reply, applied: false, diagram: input.diagram };
  }

  const freezePlayers = hasImage
    ? false
    : wantsKeepPriorFrame(drawMessage)
      ? false
      : lockedReading?.freezePlayers ?? wantsFrozenPlayers(drawMessage);
  const wantsSeq = hasImage
    ? sourceDiagramMode === 'all'
    : lockedReading?.sequence ?? wantsSequenceFromMessage(drawMessage);

  let validatedDiagram: WebDiagramV1 | null = null;
  let lockedDsl: BoardSymbolicDsl | null = null;

  if (symbolicDsl) {
    const rawDsl = (parsed as { dsl?: unknown }).dsl;
    if (rawDsl == null) {
      console.warn('[board-ai] dsl missing; coordinate diagram ignored');
      return {
        ...resultBase,
        reply: `${reply}\n\n(I need a symbolic plan, not coordinates — board left as-is.)`,
        applied: false,
        diagram: input.diagram,
      };
    }
    const parsedDsl = parseBoardSymbolicDsl(rawDsl);
    if (!parsedDsl.ok) {
      console.warn('[board-ai] dsl rejected', parsedDsl.error);
      return {
        ...resultBase,
        reply: `${reply}\n\n(I planned the picture in symbols but placement failed — board left as-is.)`,
        applied: false,
        diagram: input.diagram,
      };
    }
    lockedDsl = lockDslForTurn(parsedDsl.dsl, {
      freeze: freezePlayers,
      hasImage,
      importDrawEleven: importAnswers?.draw === 'eleven' || wantsScaleToEleven(drawMessage),
      fromCurrentBoard: wantsCurrentBoardSeed(drawMessage),
      keepPriorFrame: wantsKeepPriorFrame(drawMessage),
      reshape: Boolean(lockedReading?.reshape),
      currentFormat: input.diagram.pitch?.format,
      current: input.diagram,
      message: drawMessage,
      rosterHint: history.map((h) => h.content).join('\n'),
    });
    validatedDiagram = applyLockedDsl(lockedDsl, input.diagram, drawMessage);
    if (!validatedDiagram) {
      return {
        ...resultBase,
        reply: `${reply}\n\n(I planned the picture in symbols but the solved board was invalid — board left as-is.)`,
        applied: false,
        diagram: input.diagram,
      };
    }
  } else {
    if (!parsed.diagram) {
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
    validatedDiagram = validated.diagram;
  }

  if (!validatedDiagram) {
    return {
      ...resultBase,
      reply: `${reply}\n\n(I drafted a change but the diagram was invalid — board left as-is.)`,
      applied: false,
      diagram: input.diagram,
    };
  }

  let repaired = symbolicDsl
    ? validatedDiagram
    : hasImage
      ? repairBoardDiagramWithSequence(validatedDiagram, drawMessage)
      : ensureSequenceStartsFromOriginal(
          repairBoardDiagramWithSequence(validatedDiagram, drawMessage),
          input.diagram,
          drawMessage
        );
  if (symbolicDsl) {
    repaired = repairBoardDiagramLabels(repairBoardDiagramArrows(repaired));
    if (!hasImage && (input.diagram.players || []).length) {
      repaired = ensureSequenceStartsFromOriginal(repaired, input.diagram, drawMessage);
    }
  }
  if (freezePlayers) {
    repaired = lockSequencePlayersToOriginal(repaired, input.diagram);
  }
  repaired = applyCoachShirtEdits(repaired, drawMessage);
  repaired = unstackDiagramPlayers(repaired);
  if (lockedDsl) {
    repaired = enforceBoardInvariants(repaired, lockedDsl);
    const inv = boardInvariantErrors(repaired, lockedDsl);
    const overlap = inv.some((e) => e.startsWith('overlap'));
    const upsample = inv.some((e) => e.startsWith('upsample'));
    const repairedN = repaired.players?.length || 0;
    const currentN = input.diagram.players?.length || 0;
    if (overlap || (upsample && repairedN >= currentN)) {
      console.warn('[board-ai] invariant failed', inv.join('; '));
      return {
        ...resultBase,
        reply: `${reply}\n\n(I planned the picture in symbols but placement failed — board left as-is.)`,
        applied: false,
        diagram: input.diagram,
      };
    }
  }
  const frameArrowCount = repaired.sequence?.frames?.length
    ? repaired.sequence.frames.reduce((n, f) => n + (f.arrows?.length || 0), 0)
    : repaired.arrows?.length || 0;
  const arrowCount = Math.max(repaired.arrows?.length || 0, frameArrowCount);
  const wantsLines = /\b(pass|run|switch|arrow|press|cross|ball to|from .+ to)\b/i.test(
    drawMessage
  );
  const replyWithArrowNote =
    wantsLines && arrowCount === 0
      ? `${reply}\n\n(I couldn't attach a draw-able arrow — try naming shirt numbers, e.g. “pass from ATT 3 to ATT 7”.)`
      : reply;

  const frameCount = repaired.sequence?.frames?.length || 0;
  const playOutApplied = !hasImage && isPlayOutRequest(drawMessage) && frameCount >= 3;
  const replyWithDiagramAsk =
    hasImage && !importAnswers
      ? ensureSourceDiagramFollowUp(replyWithArrowNote, sourceDiagramMode === 'all')
      : replyWithArrowNote;
  const replyWithSequenceNote = hasImage
    ? sourceDiagramMode === 'all' && frameCount >= 2
      ? `${replyWithDiagramAsk}\n\nSequence: ${frameCount} frames — one source diagram per frame. Use the filmstrip to switch pictures.`
      : replyWithDiagramAsk
    : playOutApplied
    ? `${replyWithArrowNote}\n\nSequence: ${frameCount} frames — 1) Start (your board)  2+) teaching steps. Chassis from the 11v11 playbook. Use Play / the filmstrip to scrub; Frame 1 keeps your original positions.`
    : wantsSeq && frameCount < 2
      ? `${replyWithArrowNote}\n\n(I drew a single snapshot — ask again for “3 frames / step-by-step” if you want a sequence.)`
      : frameCount >= 2
        ? `${replyWithArrowNote}\n\nSequence: ${frameCount} frames — Frame 1 is your saved board; later frames add the play. Use Play on the board to scrub.`
        : replyWithArrowNote;

  return {
    ...resultBase,
    reply: scrubCoachReply(replyWithSequenceNote, repaired),
    applied: true,
    diagram: repaired,
  };
}
