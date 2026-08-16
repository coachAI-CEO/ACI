/**
 * Bridge: tactical board scenario → vault recommendations + session generator.
 * Used when the coach asks how to train / improve the idea on the board.
 */

import { prisma } from '../prisma';
import { clubVaultWhere } from './club-session-visibility';
import { getEnforcedClubVaultScope } from './club-game-model-scope';
import { getGameFormatForAgeGroup, getPlayersPerTeamForFormat } from '../prompts/session';
import { formatFromAgeGroup, type WebDiagramV1 } from './web-diagram-v1';
import { inferFormationsFromMessage } from './formation-principles';
import { isPlayOutRequest } from './board-phase-placement';
import { summarizeBoardCardMeta } from './board-card-meta';

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

function isStartLikeFrame(frame?: { id?: string; title?: string } | null): boolean {
  if (!frame) return false;
  if (frame.id === 'f-start') return true;
  const t = String(frame.title || '')
    .trim()
    .toLowerCase()
    .replace(/^\d+\.\s*/, '');
  return t === 'start' || t === 'start (board)' || t === 'saved board' || t === 'current board';
}

function liveDiagram(diagram: WebDiagramV1): WebDiagramV1 {
  const frames = diagram.sequence?.frames;
  if (!frames?.length) return diagram;
  const active = frames.find((f) => f.id === diagram.sequence?.activeFrameId);
  const preferred =
    active && !isStartLikeFrame(active) ? active : frames[frames.length - 1];
  return {
    ...diagram,
    players: preferred.players?.length ? preferred.players : diagram.players,
    areas: preferred.areas?.length ? preferred.areas : diagram.areas,
    labels: preferred.labels?.length ? preferred.labels : diagram.labels,
    balls: preferred.balls?.length ? preferred.balls : diagram.balls,
    arrows: preferred.arrows?.length ? preferred.arrows : diagram.arrows,
    elements: preferred.elements?.length ? preferred.elements : diagram.elements,
  };
}

function hasPressPicture(diagram: WebDiagramV1): boolean {
  return (diagram.arrows || []).some((a) => String(a.type || '').toLowerCase() === 'press');
}

function areaIntent(diagram: WebDiagramV1): string {
  return String(diagram.areas?.[0]?.label || '').toLowerCase();
}

function isFunctionBoard(diagram: WebDiagramV1): boolean {
  const n = diagram.players?.length || 0;
  if ((diagram.elements || []).some((e) => e.kind === 'mini-goal')) return true;
  if ((diagram.areas || []).some((a) => /rondo|ssg/i.test(String(a.label || '')))) return true;
  const format = diagram.pitch?.format || '11V11';
  const expected = format === '7V7' ? 14 : format === '9V9' ? 18 : 22;
  return n > 0 && n <= expected - 6;
}

function normalizePhase(
  message: string,
  historyBlob: string,
  diagram: WebDiagramV1
): BoardSessionPhase {
  const t = String(message || '').toLowerCase();
  const blob = `${historyBlob}\n${message}`.toLowerCase();
  if (/\b(press after (a )?loss|counterpress|gegenpress|defensive transition|after (ball )?loss)\b/.test(t)) {
    return 'TRANSITION_TO_DEFEND';
  }
  if (/\b(on the regain|attacking transition|counter[- ]?attack)\b/.test(t)) {
    return 'TRANSITION_TO_ATTACK';
  }
  if (
    /\b(high press|mid[- ]?block|low block|defensive organization|out of possession|defend)\b/.test(t) ||
    (/\b(train this|how should we train|how can we train)\b/i.test(t) &&
      /\b(defend|compact|wide deliver)/.test(blob))
  ) {
    return 'DEFENDING';
  }
  if (hasPressPicture(diagram) || areaIntent(diagram) === 'third_left') {
    return 'DEFENDING';
  }
  if (isFunctionBoard(diagram)) return 'ATTACKING';
  if (isPlayOutRequest(t) || /\b(build[- ]?up|in possession|attacking organization)\b/.test(t)) {
    return 'ATTACKING';
  }
  if (isPlayOutRequest(blob) || /\b(build[- ]?up|in possession|attacking organization|final third|progression)\b/.test(blob)) {
    return 'ATTACKING';
  }
  if (/\btransition\b/.test(blob)) return 'TRANSITION';
  return 'ATTACKING';
}

function normalizeZone(message: string, _historyBlob: string, diagram: WebDiagramV1): BoardSessionZone {
  const t = String(message || '').toLowerCase();
  const intent = areaIntent(diagram);
  if (intent === 'third_left' || intent === 'box_def') return 'ATTACKING_THIRD';
  if (intent === 'third_right' || intent === 'box_att' || intent === 'half_att') return 'DEFENSIVE_THIRD';
  if (intent === 'third_middle' || intent === 'rondo' || intent === 'ssg_grid') return 'MIDDLE_THIRD';
  if (
    /\b(defensive third|own third|from the back|goal[-\s]?kick|build[- ]?out|play(?:ing)? out)\b/.test(t)
  ) {
    return 'DEFENSIVE_THIRD';
  }
  if (/\b(final third|attacking third|their (box|penalty)|scoring zone|their third|high press)\b/.test(t)) {
    return 'ATTACKING_THIRD';
  }
  if (/\b(middle third|midfield|pocket|halfway|rondo|mid[- ]?block)\b/.test(t)) {
    return 'MIDDLE_THIRD';
  }
  if (isFunctionBoard(diagram)) return 'MIDDLE_THIRD';
  const ballY = diagram.balls?.[0]?.y ?? diagram.areas?.[0]?.y;
  if (typeof ballY === 'number') {
    if (ballY >= 67) return 'DEFENSIVE_THIRD';
    if (ballY <= 33) return 'ATTACKING_THIRD';
  }
  return 'MIDDLE_THIRD';
}

function topicFromContext(message: string, historyBlob: string, diagram: WebDiagramV1): string {
  if (isFunctionBoard(diagram)) {
    const area = areaIntent(diagram);
    const blob = `${historyBlob}\n${message}`;
    if (/\b(compact|wide deliver|defend(?:ing)? (?:that |the )?(?:big )?goal)\b/i.test(blob) && !/\brondo\b/i.test(blob)) {
      return 'Defending compactness / wide deliveries';
    }
    if (/rondo/i.test(area) || /\brondo\b/i.test(blob) || (diagram.players || []).length <= 10) {
      if ((diagram.elements || []).some((e) => e.kind === 'mini-goal') || /rondo/i.test(area) || /\brondo\b/i.test(blob)) {
        return 'Rondo / possession in a grid';
      }
    }
    if (/ssg/i.test(area)) return 'Small-sided game';
    if ((diagram.elements || []).some((e) => e.kind === 'mini-goal')) {
      return 'Rondo / possession in a grid';
    }
    const cleaned = message
      .replace(/\b(how can|how should|we train this|my team|improve|session|please|recommend)\b/gi, '')
      .trim();
    return cleaned.slice(0, 120) || 'Functional practice';
  }
  if (hasPressPicture(diagram) || /high press|pressing/i.test(message) || areaIntent(diagram) === 'third_left') {
    return 'High press in their third';
  }
  if (/\bmid[- ]?block\b/i.test(message) || areaIntent(diagram) === 'third_middle') {
    if (!isPlayOutRequest(message)) return 'Mid-block compactness';
  }
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

  if (isPlayOutRequest(`${message}`) || isPlayOutRequest(historyBlob)) {
    if (!hasPressPicture(diagram)) {
      return 'Playing out from the back / build-up under press';
    }
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
  const live = liveDiagram(input.diagram);
  const format = live.pitch?.format;
  const inputAge = String(input.ageGroup || '').toUpperCase().replace(/^U0*/, 'U');
  const formatFromInput = inputAge ? formatFromAgeGroup(inputAge) : undefined;
  const ageGroup =
    inputAge && (!format || formatFromInput === format)
      ? inputAge
      : format === '7V7'
        ? 'U10'
        : format === '9V9'
          ? 'U12'
          : inputAge || 'U13';
  const defaults = defaultsForAge(ageGroup);
  const functionBoard = isFunctionBoard(live);
  const card = summarizeBoardCardMeta(live);
  const fromMessage = inferFormationsFromMessage(input.message);
  const formations = functionBoard
    ? { att: null as string | null, def: null as string | null }
    : {
        att: card.attFormation || fromMessage.att,
        def: card.defFormation || fromMessage.def,
      };

  const phase = normalizePhase(input.message, historyBlob, live);
  const zone = normalizeZone(input.message, historyBlob, live);
  const topic = topicFromContext(input.message, historyBlob, live);
  const shirts = live.players?.length || 0;
  const numbersMin = functionBoard && shirts > 0 ? Math.max(4, shirts - 2) : defaults.numbersMin;
  const numbersMax = functionBoard && shirts > 0 ? shirts : defaults.numbersMax;

  return {
    gameModelId: String(input.gameModelId || 'POSSESSION').toUpperCase(),
    ageGroup,
    phase,
    zone,
    formationAttacking: formations.att || (functionBoard ? 'as-drawn' : defaults.defaultAtt),
    formationDefending: formations.def || (functionBoard ? 'as-drawn' : defaults.defaultDef),
    playerLevel: String(input.playerLevel || 'INTERMEDIATE').toUpperCase(),
    coachLevel: String(input.coachLevel || 'USSF_D').toUpperCase(),
    topic,
    durationMin: 90,
    numbersMin,
    numbersMax,
    goalsAvailable: (() => {
      if (!functionBoard) return defaults.goalsAvailable;
      const mini = (live.elements || []).filter((e) => e.kind === 'mini-goal').length;
      const rondo = (live.areas || []).some((a) => /rondo/i.test(String(a.label || '')));
      return rondo && mini < 2 ? 0 : mini;
    })(),
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
  userId?: string | null,
  limit = 5
): Promise<BoardSessionRecommendation[]> {
  const vaultScope = await getEnforcedClubVaultScope(userId || undefined);
  const where: Record<string, unknown> = {
    savedToVault: true,
    ...clubVaultWhere({
      clubId: vaultScope.clubId,
      gameModelId: vaultScope.gameModelId || params.gameModelId,
    }),
  };
  if (params.ageGroup) where.ageGroup = params.ageGroup;
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

/** Drop vault hits that are the wrong activity even if age/game-model matched. */
function recFormationFitsPicture(
  used: string | null | undefined,
  params: BoardSessionParams
): boolean {
  if (!used) return true;
  const tokens = used.match(/\d(?:-\d){1,3}/g) || [];
  if (!tokens.length) return true;
  const ok = new Set(
    [params.formationAttacking, params.formationDefending].filter(Boolean).map((s) => String(s))
  );
  const known = new Set([
    '2-3-1',
    '3-2-1',
    '3-2-3',
    '2-3-2-1',
    '3-3-2',
    '4-3-3',
    '4-4-2',
    '4-2-3-1',
    '3-5-2',
  ]);
  const named = tokens.filter((t) => known.has(t));
  if (!named.length) return true;
  return named.some((t) => ok.has(t));
}

export function vaultRecommendationFitsPicture(
  rec: Pick<
    BoardSessionRecommendation,
    'title' | 'summary' | 'phase' | 'zone' | 'similarity' | 'formationUsed'
  >,
  params: BoardSessionParams
): boolean {
  if (rec.similarity < 0.28) return false;
  if (!recFormationFitsPicture(rec.formationUsed, params)) return false;
  const blob = `${rec.title} ${rec.summary || ''} ${rec.phase} ${rec.zone}`.toLowerCase();
  const topic = params.topic.toLowerCase();
  const smallSided =
    params.numbersMax <= 16 ||
    /rondo|ssg|functional practice|as-drawn|compact|wide deliver/i.test(topic);
  const rondoLike = /\brondo\b|keepaway|keep-away|4v4|5v2|\bssg\b/;
  if (params.formationAttacking === 'as-drawn' || params.formationDefending === 'as-drawn') {
    const tokens = String(rec.formationUsed || '').match(/\d(?:-\d){1,3}/g) || [];
    if (tokens.some((t) => /^(4-3-3|4-4-2|4-2-3-1|3-5-2)$/.test(t))) return false;
  }
  if (smallSided && /final third|play(?:ing)? out|build[- ]?up|penetration/i.test(blob) && !rondoLike.test(blob)) {
    return false;
  }
  if (/rondo/.test(topic) && !rondoLike.test(blob)) {
    return false;
  }
  if (
    /high press|pressing/.test(topic) &&
    /play(?:ing)? out|build[- ]?up/.test(blob) &&
    !/press/.test(blob)
  ) {
    return false;
  }
  if (
    /mid[- ]?block/.test(topic) &&
    /play(?:ing)? out|final third/.test(blob) &&
    !/block|compact|defend/.test(blob)
  ) {
    return false;
  }
  if (
    /play(?:ing)? out|build[- ]?up/.test(topic) &&
    /breaking lines|penetration|middle[_ ]third/.test(blob) &&
    !/play(?:ing)? out|from the back|goal[-\s]?kick|defensive third/.test(`${rec.title} ${rec.summary || ''}`)
  ) {
    return false;
  }
  if (
    /high press|pressing/.test(topic) &&
    rec.zone === 'DEFENSIVE_THIRD' &&
    !/press/.test(`${rec.title} ${rec.summary || ''}`)
  ) {
    return false;
  }
  return true;
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
  userId?: string | null;
}): Promise<BoardSessionBridgeResult> {
  const params = buildBoardSessionParams(input);
  const recommendations = (await searchVaultSessions(params, input.userId, 5)).filter((r) =>
    vaultRecommendationFitsPicture(r, params)
  );
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
      `No close vault match for this picture (saved sessions are a different activity). Use the pre-filled Session Builder prompt below to generate one.`
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
