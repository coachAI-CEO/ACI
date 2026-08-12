import { generateText, setMetricsContext, clearMetricsContext } from '../gemini';
import { parseWebDiagramV1 } from './board-diagram-schema';
import { toWebDiagramV1, type WebDiagramV1 } from './web-diagram-v1';
import {
  getClubPhilosophy,
  philosophyHasContent,
  type ClubPhilosophyStages,
} from './club-philosophy';
import { getGameModelTemplate, getGameModelTemplatePhilosophy } from './game-model-templates';

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
  return {
    ...diagram,
    players: (diagram.players || []).map((p) => ({
      id: p.id,
      number: p.number,
      team: p.team,
      role: p.role,
      x: p.x,
      y: p.y,
    })),
    arrows: (diagram.arrows || []).map((a) => ({
      from: a.from,
      to: a.to,
      type: a.type,
      style: a.style,
      weight: a.weight,
      ...(typeof a.arrowhead === 'boolean' ? { arrowhead: a.arrowhead } : {}),
      ...(a.control ? { control: a.control } : {}),
      ...(a.path && a.path.length >= 2 ? { path: a.path.slice(0, 40) } : {}),
    })),
    areas: diagram.areas || [],
    labels: diagram.labels || [],
    balls: diagram.balls || [],
    goals: diagram.goals,
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

function pointInArea(
  pos: { x: number; y: number },
  area: { x?: number; y?: number; width?: number; height?: number }
) {
  if (typeof area.x !== 'number' || typeof area.y !== 'number') return false;
  const w = area.width ?? 0;
  const h = area.height ?? 0;
  return pos.x >= area.x && pos.x <= area.x + w && pos.y >= area.y && pos.y <= area.y + h;
}

/** Move captions that sit inside highlights to just outside the zone (top touchline side). */
export function repairBoardDiagramLabels(diagram: WebDiagramV1): WebDiagramV1 {
  const areas = diagram.areas || [];
  if (!areas.length) return diagram;
  const labels = (diagram.labels || []).map((label) => {
    const hit = areas.find((a) => pointInArea(label, a));
    if (!hit || typeof hit.x !== 'number' || typeof hit.y !== 'number') return label;
    const w = hit.width ?? 10;
    const h = hit.height ?? 10;
    return {
      ...label,
      text: String(label.text || '').slice(0, 160),
      x: clamp01to100Local(hit.x + w + 4),
      y: clamp01to100Local(hit.y + h / 2),
    };
  });
  return { ...diagram, labels };
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
  return /\b(just draw|draw it|use defaults?|don'?t ask|do not ask|no questions|go ahead|apply (?:it|now)|skip clarif)/i.test(
    message
  );
}

function hasFormationDetail(text: string): boolean {
  // e.g. 2-3-1, 4-2-3-1, "formation 3-2-1"
  return (
    /\b\d-\d(?:-\d){1,3}\b/.test(text) ||
    /\bformations?\b[\s\S]{0,40}\b\d-\d/.test(text) ||
    /\b(?:att|def|home|away)\s+\d-\d(?:-\d){0,3}\b/i.test(text)
  );
}

function hasChannelDetail(text: string): boolean {
  return /\b(left|right)\s+(channel|side|half|wing|flank|half[-\s]?space)\b/i.test(text) ||
    /\b(wide|wing|flank|touchline|half[-\s]?space)\b/i.test(text) ||
    /\b(central|center|centre)\s+(channel|lane|corridor|area|zone)?\b/i.test(text) ||
    /\b(middle of the (?:pitch|field|park)|through the middle)\b/i.test(text) ||
    /\bon the (left|right|weak|strong) side\b/i.test(text);
}

function hasPhaseDetail(text: string): boolean {
  return (
    /\b(attacking organization|defensive organization|defensive transition|attacking transition)\b/i.test(
      text
    ) ||
    /\b(in possession|out of possession|build[-\s]?up|press after (?:a )?loss|after (?:ball )?loss|on (?:the )?regain|counterpress|rest defence|rest defense)\b/i.test(
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

export function assessScenarioGaps(message: string, history: BoardAiChatMessage[] = []): ScenarioGaps {
  const blob = conversationBlob(message, history);
  return {
    missingFormation: !hasFormationDetail(blob),
    missingChannel: !hasChannelDetail(blob),
    missingPhase: !hasPhaseDetail(blob),
  };
}

export function needsBoardClarification(
  message: string,
  history: BoardAiChatMessage[] = []
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
  const gaps = assessScenarioGaps(message, history);
  // Formation + where (channel) are required before drawing; phase asked when missing
  return gaps.missingFormation || gaps.missingChannel || gaps.missingPhase;
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
      `${n}. Formations — e.g. for 7v7: ATT 2-3-1 vs DEF 3-2-1 (or the shapes you want).`
    );
    n += 1;
  }
  if (input.gaps.missingChannel) {
    lines.push(
      `${n}. Where across the pitch — left channel, central, or right channel?`
    );
    n += 1;
  }
  if (input.gaps.missingPhase) {
    lines.push(
      `${n}. Phase — Attacking Organization, Defensive Transition, Defensive Organization, or Attacking Transition?`
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
}): string {
  const historyBlock =
    input.history.length === 0
      ? '(none)'
      : input.history
          .slice(-8)
          .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
          .join('\n');

  const playerIndex = (input.diagram.players || [])
    .map((p) => `${p.id} (#${p.number ?? '?'} ${p.team} ${p.role || ''}) @(${Math.round(p.x)},${Math.round(p.y)})`)
    .join('\n');

  const focusHint = inferFocusThirdFromMessage(input.message);

  const clarifyBlock = input.clarifyRequired
    ? [
        'CLARIFY-FIRST (MANDATORY THIS TURN):',
        '- The coach request is too vague to draw accurately.',
        `- Missing: ${[
          input.gaps.missingFormation ? 'formations (both teams)' : null,
          input.gaps.missingChannel ? 'channel/side (left, central, or right)' : null,
          input.gaps.missingPhase ? 'phase of play' : null,
        ]
          .filter(Boolean)
          .join('; ')}.`,
        '- Set apply=false. Do NOT change the diagram.',
        '- In reply, ask ONLY for the missing items (formations, where across the pitch, phase). Keep it short and coach-friendly.',
        '- Ground the ask in the club play model (e.g. which transition stage).',
        '- Write clarifying questions at the coachLevel vocabulary (D plain / C one concept / B+ systemic).',
        '- If the coach said “just draw it” / “use defaults”, then you may apply with sensible defaults.',
      ].join('\n')
    : [
        'CLARITY CHECK:',
        '- If formations, channel (left/central/right), or phase are still unclear from chat history, set apply=false and ask before drawing.',
        '- When those are present (or coach forced defaults), apply=true and draw.',
      ].join('\n');

  return [
    'You are Tactical Edge AI — a soccer coaching assistant that edits a tactical board diagram.',
    'The coach describes a scenario in natural language. You update the board diagram JSON to match.',
    'You coach through the club’s locked game model — answers and drawings must show how THIS club wants to play.',
    'Prefer asking a short clarifying question over guessing when the picture would be wrong.',
    '',
    input.playModelGuidance,
    '',
    input.languageGuidance,
    '',
    clarifyBlock,
    '',
    'COORDINATE SYSTEM (critical):',
    '- Pitch is HORIZONTAL. Goal-to-goal axis is diagram y (0=left / DEF goal, 100=right / ATT goal).',
    '- Touchline axis is diagram x (0–100). On screen, high x is toward the top touchline.',
    '- DEF (away) attacks left→right (own goal near y≈0). ATT (home) attacks right→left (own goal near y≈100).',
    '- Mirror lateral roles for DEF so right-sided players stay on that team’s right.',
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
    '- 11v11: 4-3-3, 4-2-3-1, 4-4-2, 3-5-2',
    '',
    'DIAGRAM RULES:',
    '- Return a FULL diagram object every time you apply changes (not a patch).',
    '- When apply=false, still return the CURRENT diagram unchanged.',
    '- Keep pitch.orientation = "HORIZONTAL".',
    '- players: team ATT|DEF|NEUTRAL, x/y 0–100, stable unique ids (e.g. att-9, def-6).',
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
    '- labels: explanatory coaching captions that say WHAT the drawing shows (≤160 chars).',
    '  Write action language with shirt numbers — not vague titles like “Counterpress Window”.',
    '  Good: “#3 presses the space; #6 gets on the 6’s back; nearest 2 hunt the ball.”',
    '  Good: “ATT #8 jumps the bounce; #4 covers inside; #9 locks the front.”',
    '  Bad: “Press”, “Transition”, “Counterpress Window”.',
    '  Prefer 1–2 short sentences that narrate the arrows/players on the pitch.',
    '  Place OUTSIDE highlights — never center text inside an area.',
    '  Prefer just above the zone toward the top touchline: x ≈ area.x + area.width + 3, y ≈ area.y + area.height/2.',
    '  Always include at least one label when you draw presses/runs/passes so the picture is readable.',
    '- balls: 0–1 centre ball unless asked otherwise.',
    '- Max: 30 players, 40 arrows, 20 areas, 20 labels.',
    '',
    'OUTPUT: ONLY a JSON object (no markdown prose outside JSON):',
    '{',
    '  "reply": "short coach-facing summary OR clarifying questions grounded in the club play model",',
    '  "apply": true|false,',
    '  "diagram": { ...full WebDiagramV1... }',
    '}',
    '',
    `Age group context: ${input.ageGroup || 'unknown'}`,
    `Game model id: ${input.gameModelId || 'unknown'}`,
    '',
    'PLAYER INDEX (use these ids in arrow from/to when possible):',
    playerIndex || '(no players yet)',
    '',
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

export async function runBoardAiChat(input: {
  diagram: WebDiagramV1;
  message: string;
  history?: BoardAiChatMessage[];
  ageGroup?: string | null;
  gameModelId?: string | null;
  clubId?: string | null;
  coachLevel?: string | null;
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
  const gaps = assessScenarioGaps(message, history);
  const clarifyRequired = needsBoardClarification(message, history);
  const playModel = await resolveBoardPlayModelContext({
    gameModelId: input.gameModelId,
    clubId: input.clubId,
  });
  const playModelGuidance = buildBoardPlayModelGuidance(playModel);
  const languageGuidance = buildBoardLanguageGuidance(audience);

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
      timeout: 60000,
      retries: 1,
      model: process.env.GEMINI_BOARD_AI_MODEL || process.env.GEMINI_FAST_MODEL,
    });
  } finally {
    clearMetricsContext();
  }

  const parsed = parseJsonObject(text);
  if (!parsed || typeof parsed !== 'object') {
    return {
      ...resultBase,
      reply: "I couldn't format a board update. Try a clearer scenario (e.g. “7v7 ATT 2-3-1 vs DEF 3-2-1, central channel, Defensive Transition — press after loss in their defensive third”).",
      applied: false,
      diagram: input.diagram,
    };
  }

  const reply =
    typeof parsed.reply === 'string' && parsed.reply.trim()
      ? parsed.reply.trim().slice(0, 2000)
      : 'Updated the board.';
  const apply = parsed.apply !== false;

  // Safety: never apply if gaps reappear (e.g. new vague turn after history reset)
  if (apply && needsBoardClarification(message, history)) {
    return {
      ...resultBase,
      reply: buildClarifyingReply({
        gaps: assessScenarioGaps(message, history),
        gameModelId: playModel.gameModelId || input.gameModelId,
        ageGroup: input.ageGroup,
        clubName: playModel.clubName,
      }),
      applied: false,
      diagram: input.diagram,
    };
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

  const repaired = repairBoardDiagramFocusZone(
    repairBoardDiagramLabels(repairBoardDiagramArrows(validated.diagram)),
    message
  );
  const arrowCount = repaired.arrows?.length || 0;
  const wantsLines = /\b(pass|run|switch|arrow|press|cross|ball to|from .+ to)\b/i.test(message);
  const replyWithArrowNote =
    wantsLines && arrowCount === 0
      ? `${reply}\n\n(I couldn't attach a draw-able arrow — try naming shirt numbers, e.g. “pass from ATT 3 to ATT 7”.)`
      : reply;

  return {
    ...resultBase,
    reply: replyWithArrowNote,
    applied: true,
    diagram: repaired,
  };
}
