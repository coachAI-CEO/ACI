/**
 * Bridge: tactical board scenario → vault recommendations + session generator.
 * Used when the coach asks how to train / improve the idea on the board.
 */

import { prisma } from '../prisma';
import { getGameFormatForAgeGroup, getPlayersPerTeamForFormat } from '../prompts/session';
import type { WebDiagramV1 } from './web-diagram-v1';
import { inferFormationsFromMessage } from './formation-principles';
import { isPlayOutRequest } from './board-phase-placement';

export type BoardSessionPhase =
  | 'ATTACKING'
  | 'DEFENDING'
  | 'TRANSITION'
  | 'TRANSITION_TO_ATTACK'
  | 'TRANSITION_TO_DEFEND';

export type BoardSessionZone = 'DEFENSIVE_THIRD' | 'MIDDLE_THIRD' | 'ATTACKING_THIRD';

export type BoardSessionParams = {
  gameModelId: string;
  ageGroup: string;
  phase: BoardSessionPhase;
  zone: BoardSessionZone;
  formationAttacking: string;
  formationDefending: string;
  playerLevel: string;
  coachLevel: string;
  topic: string;
  durationMin: number;
  numbersMin: number;
  numbersMax: number;
  goalsAvailable: number;
  spaceConstraint: string;
  searchQuery: string;
};

export type BoardSessionRecommendation = {
  id: string;
  title: string;
  ageGroup?: string | null;
  gameModelId?: string | null;
  phase?: string | null;
  zone?: string | null;
  formationUsed?: string | null;
  durationMin?: number | null;
  similarity: number;
  summary?: string | null;
  openUrl: string;
};

export type BoardSessionBridgeResult = {
  params: BoardSessionParams;
  recommendations: BoardSessionRecommendation[];
  generatorUrl: string;
  generatorPrompt: string;
  reply: string;
};

/** Coach wants training help / vault / generator — not (only) a board redraw. */
export function isSessionImproveRequest(message: string): boolean {
  const m = String(message || '').toLowerCase();
  return (
    /\b(how (can|do|should) (we|my team|i|the team) improve|improve (in )?this|train (this|for this)|practice (this|it)|session (for|on|about)|recommend (a )?session|find (a )?session|from the vault|generate (a )?session|build (a )?session|what (session|drill)|work on this|coaching session|training session)\b/i.test(
      m
    ) ||
    /\b(turn this into|make this into) (a )?(session|practice|training)\b/i.test(m) ||
    /\b(vault|session builder|generator)\b/i.test(m)
  );
}

function normalizePhase(message: string, historyBlob: string): BoardSessionPhase {
  const t = `${historyBlob}\n${message}`.toLowerCase();
  if (/\b(press after (a )?loss|counterpress|gegenpress|defensive transition|after (ball )?loss)\b/.test(t)) {
    return 'TRANSITION_TO_DEFEND';
  }
  if (/\b(on the regain|attacking transition|counter[- ]?attack)\b/.test(t)) {
    return 'TRANSITION_TO_ATTACK';
  }
  if (/\b(defensive organization|out of possession|low block|mid block|defend)\b/.test(t)) {
    return 'DEFENDING';
  }
  if (isPlayOutRequest(t) || /\b(build[- ]?up|in possession|attacking organization|final third|progression)\b/.test(t)) {
    return 'ATTACKING';
  }
  if (/\btransition\b/.test(t)) return 'TRANSITION';
  return 'ATTACKING';
}

function normalizeZone(message: string, historyBlob: string, diagram: WebDiagramV1): BoardSessionZone {
  const t = `${historyBlob}\n${message}`.toLowerCase();
  if (
    /\b(defensive third|own third|from the back|goal[-\s]?kick|build[- ]?out|play(?:ing)? out)\b/.test(t)
  ) {
    return 'DEFENSIVE_THIRD';
  }
  if (/\b(final third|attacking third|their (box|penalty)|scoring zone)\b/.test(t)) {
    return 'ATTACKING_THIRD';
  }
  if (/\b(middle third|midfield|pocket|halfway)\b/.test(t)) {
    return 'MIDDLE_THIRD';
  }
  // Infer from ball / highlight on the board
  const ballY =
    diagram.balls?.[0]?.y ??
    diagram.sequence?.frames?.[0]?.balls?.[0]?.y ??
    diagram.areas?.[0]?.y;
  if (typeof ballY === 'number') {
    if (ballY >= 67) return 'DEFENSIVE_THIRD'; // ATT own third (right)
    if (ballY <= 33) return 'ATTACKING_THIRD';
  }
  return 'MIDDLE_THIRD';
}

function topicFromContext(message: string, historyBlob: string, diagram: WebDiagramV1): string {
  const labels = [
    ...(diagram.labels || []).map((l) => l.text),
    ...(diagram.sequence?.frames || []).flatMap((f) => (f.labels || []).map((l) => l.text)),
  ]
    .filter(Boolean)
    .slice(0, 4);
  const frameTitles = (diagram.sequence?.frames || [])
    .map((f) => f.title)
    .filter(Boolean)
    .slice(0, 3);

  if (isPlayOutRequest(`${historyBlob}\n${message}`)) {
    return 'Playing out from the back / build-up under press';
  }
  if (/\bpress after|counterpress|gegenpress\b/i.test(message)) {
    return 'Counterpress after loss';
  }
  if (labels[0]) return String(labels[0]).slice(0, 120);
  if (frameTitles[0]) return String(frameTitles[0]).slice(0, 120);
  const cleaned = message.replace(/\b(how can|my team|improve|session|please|recommend)\b/gi, '').trim();
  return cleaned.slice(0, 120) || 'Board scenario training';
}

function defaultsForAge(ageGroup: string): {
  numbersMin: number;
  numbersMax: number;
  spaceConstraint: string;
  goalsAvailable: number;
  defaultAtt: string;
  defaultDef: string;
} {
  const format = getGameFormatForAgeGroup(ageGroup);
  const per = getPlayersPerTeamForFormat(format);
  const total = per * 2;
  if (format === '7v7') {
    return {
      numbersMin: total - 2,
      numbersMax: total,
      spaceConstraint: 'HALF',
      goalsAvailable: 2,
      defaultAtt: '2-3-1',
      defaultDef: '3-2-1',
    };
  }
  if (format === '9v9') {
    return {
      numbersMin: total - 2,
      numbersMax: total,
      spaceConstraint: 'HALF',
      goalsAvailable: 2,
      defaultAtt: '3-2-3',
      defaultDef: '3-3-2',
    };
  }
  return {
    numbersMin: 18,
    numbersMax: 22,
    spaceConstraint: 'HALF',
    goalsAvailable: 2,
    defaultAtt: '4-3-3',
    defaultDef: '4-4-2',
  };
}

export function buildBoardSessionParams(input: {
  message: string;
  history?: Array<{ role: string; content: string }>;
  diagram: WebDiagramV1;
  ageGroup?: string | null;
  gameModelId?: string | null;
  coachLevel?: string | null;
  playerLevel?: string | null;
}): BoardSessionParams {
  const historyBlob = (input.history || []).map((h) => h.content).join('\n');
  const blob = `${historyBlob}\n${input.message}`;
  const ageGroup = String(input.ageGroup || 'U13').toUpperCase().replace(/^U0*/, 'U');
  const defaults = defaultsForAge(ageGroup);
  const formations = inferFormationsFromMessage(blob);

  const phase = normalizePhase(input.message, historyBlob);
  const zone = normalizeZone(input.message, historyBlob, input.diagram);
  const topic = topicFromContext(input.message, historyBlob, input.diagram);

  return {
    gameModelId: String(input.gameModelId || 'POSSESSION').toUpperCase(),
    ageGroup,
    phase,
    zone,
    formationAttacking: formations.att || defaults.defaultAtt,
    formationDefending: formations.def || defaults.defaultDef,
    playerLevel: String(input.playerLevel || 'INTERMEDIATE').toUpperCase(),
    coachLevel: String(input.coachLevel || 'USSF_D').toUpperCase(),
    topic,
    durationMin: 90,
    numbersMin: defaults.numbersMin,
    numbersMax: defaults.numbersMax,
    goalsAvailable: defaults.goalsAvailable,
    spaceConstraint: defaults.spaceConstraint,
    searchQuery: [topic, phase, zone, formations.att, formations.def].filter(Boolean).join(' '),
  };
}

export function buildGeneratorUrl(params: BoardSessionParams, opts?: { autoGenerate?: boolean }): string {
  const q = new URLSearchParams();
  q.set('gameModelId', params.gameModelId);
  q.set('ageGroup', params.ageGroup);
  q.set('phase', params.phase);
  q.set('zone', params.zone);
  q.set('topic', params.topic);
  q.set('formationAttacking', params.formationAttacking);
  q.set('formationDefending', params.formationDefending);
  q.set('playerLevel', params.playerLevel);
  q.set('coachLevel', params.coachLevel);
  q.set('durationMin', String(params.durationMin));
  q.set('numbersMin', String(params.numbersMin));
  q.set('numbersMax', String(params.numbersMax));
  q.set('goalsAvailable', String(params.goalsAvailable));
  q.set('spaceConstraint', params.spaceConstraint);
  q.set('autoGenerate', opts?.autoGenerate ? 'true' : 'false');
  q.set('requestId', String(Date.now()));
  return `/demo/session?${q.toString()}`;
}

export function buildGeneratorPrompt(params: BoardSessionParams): string {
  return [
    `Build a ${params.durationMin}-min ${params.ageGroup} session`,
    `Game model: ${params.gameModelId.replace(/_/g, ' ')}`,
    `Phase: ${params.phase.replace(/_/g, ' ')} · Zone: ${params.zone.replace(/_/g, ' ')}`,
    `Topic: ${params.topic}`,
    `Formations: ATT ${params.formationAttacking} vs DEF ${params.formationDefending}`,
    `Players: ${params.numbersMin}–${params.numbersMax} · Space: ${params.spaceConstraint} · Goals: ${params.goalsAvailable}`,
    `Coach ${params.coachLevel.replace(/_/g, ' ')} · Players ${params.playerLevel}`,
  ].join('\n');
}

async function searchVaultSessions(
  params: BoardSessionParams,
  limit = 5
): Promise<BoardSessionRecommendation[]> {
  const where: Record<string, unknown> = { savedToVault: true };
  if (params.ageGroup) where.ageGroup = params.ageGroup;
  if (params.gameModelId) where.gameModelId = params.gameModelId;
  // Prefer phase match but don't over-filter to empty
  const strict = await prisma.session.findMany({
    where: { ...where, phase: params.phase as any },
    orderBy: { createdAt: 'desc' },
    take: 40,
    select: {
      id: true,
      title: true,
      gameModelId: true,
      ageGroup: true,
      phase: true,
      zone: true,
      durationMin: true,
      formationUsed: true,
      json: true,
    },
  });

  let pool = strict;
  if (pool.length < 3) {
    pool = await prisma.session.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        title: true,
        gameModelId: true,
        ageGroup: true,
        phase: true,
        zone: true,
        durationMin: true,
        formationUsed: true,
        json: true,
      },
    });
  }

  const words = params.searchQuery
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);

  const scored = pool
    .map((s) => {
      const summary = String((s.json as any)?.summary || '');
      const content = `${s.title || ''} ${summary} ${s.formationUsed || ''} ${s.zone || ''}`.toLowerCase();
      let score = 0.15;
      for (const w of words) {
        if (content.includes(w)) score += 1;
      }
      if (s.phase === params.phase) score += 1.5;
      if (s.zone === params.zone) score += 1;
      if (
        s.formationUsed &&
        (s.formationUsed === params.formationAttacking ||
          s.formationUsed === params.formationDefending)
      ) {
        score += 0.8;
      }
      return {
        session: s,
        similarity: Math.min(1, score / Math.max(words.length + 3, 1)),
        summary: summary.slice(0, 180) || null,
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return scored.map((r) => ({
    id: r.session.id,
    title: r.session.title || 'Untitled session',
    ageGroup: r.session.ageGroup,
    gameModelId: r.session.gameModelId,
    phase: r.session.phase,
    zone: r.session.zone,
    formationUsed: r.session.formationUsed,
    durationMin: r.session.durationMin,
    similarity: r.similarity,
    summary: r.summary,
    openUrl: `/demo/session?sessionId=${encodeURIComponent(r.session.id)}`,
  }));
}

function formatPhaseLabel(p: string) {
  return p.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function runBoardSessionBridge(input: {
  message: string;
  history?: Array<{ role: string; content: string }>;
  diagram: WebDiagramV1;
  ageGroup?: string | null;
  gameModelId?: string | null;
  coachLevel?: string | null;
  playerLevel?: string | null;
}): Promise<BoardSessionBridgeResult> {
  const params = buildBoardSessionParams(input);
  const recommendations = await searchVaultSessions(params, 5);
  const generatorUrl = buildGeneratorUrl(params, { autoGenerate: false });
  const generatorPrompt = buildGeneratorPrompt(params);

  const lines: string[] = [
    `From what’s on the board, here’s how I’d train it.`,
    '',
    `Focus: ${params.topic}`,
    `${params.ageGroup} · ${formatPhaseLabel(params.phase)} · ${formatPhaseLabel(params.zone)}`,
    `ATT ${params.formationAttacking} vs DEF ${params.formationDefending} · ${params.gameModelId.replace(/_/g, ' ')}`,
    '',
  ];

  if (recommendations.length) {
    lines.push(
      `Vault: ${recommendations.length} saved session${recommendations.length === 1 ? '' : 's'} that fit — open one below, or generate a fresh session with the board params already filled in.`
    );
  } else {
    lines.push(
      `No close vault match for this exact combo. Use the pre-filled Session Builder prompt below to generate one.`
    );
  }

  lines.push('', 'Generator prompt (already mapped from the board):', generatorPrompt);

  return {
    params,
    recommendations,
    generatorUrl,
    generatorPrompt,
    reply: lines.join('\n'),
  };
}
