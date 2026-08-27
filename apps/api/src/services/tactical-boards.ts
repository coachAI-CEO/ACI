import {
  BoardShareMode,
  GameModelId,
  Prisma,
  UserRole,
} from '@prisma/client';
import { prisma } from '../prisma';
import { lookupByRefCode } from '../utils/ref-code';
import { normalizeDiagramLegacyToV1 } from './diagram';
import {
  parseClientGameModelId,
  resolveBoardClubStamp,
} from './board-club-stamp';
import { sessionVisibleToClub } from './club-session-visibility';
import { BOARD_DIAGRAM_MAX_FRAMES, BOARD_TITLE_MAX_LEN, parseWebDiagramV1 } from './board-diagram-schema';
import {
  defaultMatchBoardDiagram,
  extractRawDiagramFromDrill,
  formatFromAgeGroup,
  isDiagramThinForFork,
  remapSessionDiagramToBoard,
  toWebDiagramV1,
  type WebDiagramV1,
} from './web-diagram-v1';
import { summarizeBoardCardMeta } from './board-card-meta';

export class TacticalBoardError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type BoardListCursor = {
  updatedAt: string;
  id: string;
};

export function encodeBoardCursor(updatedAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ updatedAt: updatedAt.toISOString(), id }), 'utf8').toString(
    'base64url'
  );
}

export function decodeBoardCursor(raw: string | undefined | null): BoardListCursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (
      parsed &&
      typeof parsed.updatedAt === 'string' &&
      typeof parsed.id === 'string' &&
      !Number.isNaN(Date.parse(parsed.updatedAt))
    ) {
      return { updatedAt: parsed.updatedAt, id: parsed.id };
    }
  } catch {
    // ignore
  }
  return null;
}

async function assertCanCreateBoards(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, adminRole: true },
  });
  if (!user) {
    throw new TacticalBoardError(401, 'UNAUTHENTICATED', 'Authentication required');
  }
  if (user.adminRole === 'SUPER_ADMIN') return;
  if (user.role === UserRole.COACH) return;

  const membership = await prisma.clubMembership.findFirst({
    where: { userId },
    select: { id: true },
  });
  if (membership) return;

  throw new TacticalBoardError(
    403,
    'FORBIDDEN',
    'Board create requires COACH role, club membership, or SUPER_ADMIN'
  );
}

async function resolveCreateGameModel(params: {
  userId: string;
  clientGameModelId?: unknown;
  forkSessionGameModelId?: GameModelId | null;
  shareMode: BoardShareMode;
  /** When true, fall back to a neutral default (`COACHAI`) instead of
   *  throwing GAME_MODEL_REQUIRED. Only the BLANK flow opts in. */
  allowFallbackDefault?: boolean;
}): Promise<{ clubId: string | null; gameModelId: GameModelId }> {
  const stamp = await resolveBoardClubStamp(params.userId);

  let clubId = stamp.clubId;
  let gameModelId: GameModelId | null = stamp.gameModelId;

  if (!gameModelId && params.forkSessionGameModelId) {
    gameModelId = params.forkSessionGameModelId;
  }

  if (!gameModelId) {
    gameModelId = parseClientGameModelId(params.clientGameModelId);
  }

  if (!gameModelId && params.allowFallbackDefault) {
    gameModelId = GameModelId.COACHAI;
  }

  if (!gameModelId) {
    throw new TacticalBoardError(
      400,
      'GAME_MODEL_REQUIRED',
      'gameModelId is required when no club stamp is available'
    );
  }

  // Club membership always wins for model stamp when present.
  if (stamp.gameModelId) {
    gameModelId = stamp.gameModelId;
    clubId = stamp.clubId;
  }

  if (params.shareMode === BoardShareMode.CLUB && !clubId) {
    throw new TacticalBoardError(
      400,
      'CLUB_REQUIRED',
      'shareMode=CLUB requires a club membership'
    );
  }

  return { clubId, gameModelId };
}

function parseShareMode(value: unknown, fallback: BoardShareMode = BoardShareMode.PRIVATE): BoardShareMode {
  if (value === 'CLUB' || value === BoardShareMode.CLUB) return BoardShareMode.CLUB;
  if (value === 'PRIVATE' || value === BoardShareMode.PRIVATE) return BoardShareMode.PRIVATE;
  if (value === undefined || value === null) return fallback;
  throw new TacticalBoardError(400, 'INVALID_SHARE_MODE', 'shareMode must be PRIVATE or CLUB');
}

function normalizeTitle(value: unknown): string {
  if (value === undefined || value === null || value === '') return 'Untitled';
  const title = String(value).trim().slice(0, BOARD_TITLE_MAX_LEN);
  return title || 'Untitled';
}

function boardPublic(board: {
  id: string;
  ownerUserId: string;
  clubId: string | null;
  title: string;
  diagram: Prisma.JsonValue;
  ageGroup: string | null;
  gameModelId: GameModelId;
  shareMode: BoardShareMode;
  sourceSessionId: string | null;
  sourceDrillKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}, canEdit: boolean) {
  return {
    id: board.id,
    ownerUserId: board.ownerUserId,
    clubId: board.clubId,
    title: board.title,
    diagram: board.diagram,
    ageGroup: board.ageGroup,
    gameModelId: board.gameModelId,
    shareMode: board.shareMode,
    sourceSessionId: board.sourceSessionId,
    sourceDrillKey: board.sourceDrillKey,
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
    canEdit,
  };
}

/**
 * View authz:
 * - owner → edit
 * - CLUB + same club membership + owner still in club → view
 * - else → 404
 */
export async function resolveBoardAccess(
  board: { ownerUserId: string; clubId: string | null; shareMode: BoardShareMode },
  userId: string
): Promise<{ canEdit: boolean } | null> {
  if (board.ownerUserId === userId) {
    return { canEdit: true };
  }

  if (board.shareMode !== BoardShareMode.CLUB || !board.clubId) {
    return null;
  }

  // Membership loss: if owner is no longer in stamped club, treat as PRIVATE for non-owners.
  const ownerStillInClub = await prisma.clubMembership.findUnique({
    where: {
      userId_clubId: { userId: board.ownerUserId, clubId: board.clubId },
    },
    select: { id: true },
  });
  if (!ownerStillInClub) {
    return null;
  }

  const viewerMembership = await prisma.clubMembership.findUnique({
    where: {
      userId_clubId: { userId, clubId: board.clubId },
    },
    select: { id: true },
  });
  if (!viewerMembership) {
    return null;
  }

  return { canEdit: false };
}

async function canForkSession(
  userId: string,
  session: {
    generatedBy: string | null;
    savedToVault: boolean;
    gameModelId: GameModelId;
    clubId: string | null;
  },
  isSuperAdmin: boolean
): Promise<boolean> {
  if (isSuperAdmin) return true;
  if (session.generatedBy && session.generatedBy === userId) return true;

  if (!session.savedToVault) return false;

  const memberships = await prisma.clubMembership.findMany({
    where: { userId },
    select: {
      clubId: true,
      club: { select: { id: true, gameModelId: true, active: true } },
    },
  });

  return memberships.some(
    (m) =>
      m.club?.active !== false &&
      sessionVisibleToClub({
        sessionClubId: session.clubId,
        sessionGameModelId: session.gameModelId,
        clubId: m.club.id,
        clubGameModelId: m.club.gameModelId,
      })
  );
}

function getSessionDrills(sessionJson: Prisma.JsonValue): any[] {
  if (!sessionJson || typeof sessionJson !== 'object') return [];
  const drills = (sessionJson as any).drills;
  return Array.isArray(drills) ? drills : [];
}

function pickDrillFromSession(
  drills: any[],
  opts: { drillIndex?: number; drillRefCode?: string }
): { drill: any; index: number } | null {
  if (opts.drillRefCode) {
    const code = opts.drillRefCode.trim().toUpperCase();
    const index = drills.findIndex(
      (d) => String(d?.refCode || '').toUpperCase() === code
    );
    if (index >= 0) return { drill: drills[index], index };
  }
  if (typeof opts.drillIndex === 'number' && opts.drillIndex >= 0 && opts.drillIndex < drills.length) {
    return { drill: drills[opts.drillIndex], index: opts.drillIndex };
  }
  return null;
}

async function resolveForkDiagram(drill: any, ageGroup?: string | null): Promise<WebDiagramV1> {
  let raw = extractRawDiagramFromDrill(drill);
  const refCode = typeof drill?.refCode === 'string' ? drill.refCode : null;

  if (isDiagramThinForFork(raw) && refCode) {
    const looked = await lookupByRefCode(refCode);
    if (looked?.type === 'drill' && looked.data) {
      const enriched = extractRawDiagramFromDrill(looked.data);
      if (enriched) raw = enriched;
    }
  }

  if (!raw) {
    throw new TacticalBoardError(400, 'NO_DIAGRAM', 'Drill has no diagram — use New board');
  }

  // Prefer mapping already-V1-ish JSON; fall back to legacy normalizer.
  let web = toWebDiagramV1(raw);
  if (!web || web.players.length === 0) {
    const normalized = normalizeDiagramLegacyToV1(raw);
    web = normalized ? toWebDiagramV1(normalized) : null;
  }

  if (!web || web.players.length === 0) {
    throw new TacticalBoardError(
      400,
      'NO_PLAYERS',
      'Diagram has no placeable players — use New board'
    );
  }

  web = remapSessionDiagramToBoard(web, ageGroup);

  const validated = parseWebDiagramV1(web);
  if (!validated.ok) {
    throw new TacticalBoardError(400, 'INVALID_DIAGRAM', validated.error, validated.details);
  }
  return validated.diagram;
}

function slideFromDiagram(
  web: WebDiagramV1,
  id: string,
  title: string,
  note?: string
): NonNullable<WebDiagramV1['sequence']>['frames'][number] {
  return {
    id,
    title: title.slice(0, 80),
    ...(note ? { note: note.slice(0, 300) } : {}),
    durationMs: 2400,
    players: web.players,
    arrows: web.arrows,
    areas: web.areas,
    labels: web.labels,
    balls: web.balls,
    goals: web.goals,
    coach: web.coach,
    cones: web.cones,
    elements: web.elements,
  };
}

async function tryResolveForkDiagram(
  drill: any,
  ageGroup?: string | null
): Promise<WebDiagramV1 | null> {
  try {
    return await resolveForkDiagram(drill, ageGroup);
  } catch (error) {
    if (
      error instanceof TacticalBoardError &&
      (error.code === 'NO_DIAGRAM' || error.code === 'NO_PLAYERS' || error.code === 'INVALID_DIAGRAM')
    ) {
      return null;
    }
    throw error;
  }
}

function pickBoardAgeGroup(ages: string[]): string | null {
  if (!ages.length) return null;
  const scored = ages
    .map((a) => ({ a: String(a).slice(0, 32), n: Number(String(a).replace(/^U/i, '')) }))
    .filter((x) => Number.isFinite(x.n) && x.n > 0);
  if (!scored.length) return String(ages[0]).slice(0, 32);
  scored.sort((a, b) => b.n - a.n);
  return scored[0].a;
}

async function resolveBlankBoardAudience(
  userId: string,
  body: any
): Promise<{ ageGroup: string | null; format: '7V7' | '9V9' | '11V11' }> {
  const fromBody =
    typeof body?.ageGroup === 'string' && body.ageGroup.trim()
      ? body.ageGroup.trim().slice(0, 32)
      : null;
  if (fromBody) {
    return { ageGroup: fromBody, format: formatFromAgeGroup(fromBody) || '11V11' };
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { teamAgeGroups: true },
  });
  const ages = Array.isArray(user?.teamAgeGroups) ? user.teamAgeGroups : [];
  const pick = pickBoardAgeGroup(ages);
  return { ageGroup: pick, format: formatFromAgeGroup(pick) || '11V11' };
}

export async function createBlankBoard(userId: string, body: any) {
  await assertCanCreateBoards(userId);
  const requestedShareMode = parseShareMode(body?.shareMode);
  // Soft-downgrade CLUB → PRIVATE if the caller has no club, instead of
  // surfacing CLUB_REQUIRED through the + New flow.
  const stamp = await resolveBoardClubStamp(userId);
  const shareMode =
    requestedShareMode === BoardShareMode.CLUB && !stamp.clubId
      ? BoardShareMode.PRIVATE
      : requestedShareMode;
  const { clubId, gameModelId } = await resolveCreateGameModel({
    userId,
    clientGameModelId: body?.gameModelId,
    shareMode,
    allowFallbackDefault: true,
  });
  const { ageGroup, format } = await resolveBlankBoardAudience(userId, body);

  const diagramCheck = parseWebDiagramV1(defaultMatchBoardDiagram(format));
  if (!diagramCheck.ok) {
    throw new TacticalBoardError(500, 'BLANK_INVALID', diagramCheck.error);
  }

  const board = await prisma.tacticalBoard.create({
    data: {
      ownerUserId: userId,
      clubId,
      title: normalizeTitle(body?.title),
      diagram: diagramCheck.diagram as unknown as Prisma.InputJsonValue,
      ageGroup,
      gameModelId,
      shareMode,
    },
  });

  return boardPublic(board, true);
}

export async function createForkBoard(userId: string, body: any, isSuperAdmin: boolean) {
  await assertCanCreateBoards(userId);

  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
  if (!sessionId) {
    throw new TacticalBoardError(400, 'SESSION_REQUIRED', 'sessionId is required');
  }

  const drillIndex =
    typeof body?.drillIndex === 'number' && Number.isInteger(body.drillIndex)
      ? body.drillIndex
      : undefined;
  const drillRefCode =
    typeof body?.drillRefCode === 'string' && body.drillRefCode.trim()
      ? body.drillRefCode.trim()
      : undefined;

  if (drillIndex === undefined && !drillRefCode) {
    throw new TacticalBoardError(
      400,
      'DRILL_SELECTOR_REQUIRED',
      'drillIndex or drillRefCode is required'
    );
  }
  if (drillIndex !== undefined && drillIndex < 0) {
    throw new TacticalBoardError(400, 'INVALID_DRILL_INDEX', 'drillIndex must be >= 0');
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      generatedBy: true,
      savedToVault: true,
      gameModelId: true,
      clubId: true,
      ageGroup: true,
      json: true,
      title: true,
    },
  });

  if (!session) {
    throw new TacticalBoardError(404, 'SESSION_NOT_FOUND', 'Session not found');
  }

  const allowed = await canForkSession(userId, session, isSuperAdmin);
  if (!allowed) {
    throw new TacticalBoardError(404, 'SESSION_NOT_FOUND', 'Session not found');
  }

  const drills = getSessionDrills(session.json);
  const picked = pickDrillFromSession(drills, { drillIndex, drillRefCode });
  if (!picked) {
    throw new TacticalBoardError(404, 'DRILL_NOT_FOUND', 'Drill not found in session');
  }

  const diagram = await resolveForkDiagram(picked.drill, session.ageGroup);
  const sourceDrillKey =
    (typeof picked.drill?.refCode === 'string' && picked.drill.refCode.trim()) ||
    `idx:${picked.index}`;

  const shareMode = parseShareMode(body?.shareMode);
  const { clubId, gameModelId } = await resolveCreateGameModel({
    userId,
    clientGameModelId: body?.gameModelId,
    forkSessionGameModelId: session.gameModelId,
    shareMode,
  });

  const title =
    typeof body?.title === 'string' && body.title.trim()
      ? normalizeTitle(body.title)
      : normalizeTitle(
          `${picked.drill?.title || picked.drill?.name || 'Drill'} — board`
        );

  const board = await prisma.tacticalBoard.create({
    data: {
      ownerUserId: userId,
      clubId,
      title,
      diagram: diagram as unknown as Prisma.InputJsonValue,
      ageGroup:
        typeof body?.ageGroup === 'string'
          ? body.ageGroup.slice(0, 32)
          : session.ageGroup || null,
      gameModelId,
      shareMode,
      sourceSessionId: session.id,
      sourceDrillKey,
    },
  });

  return boardPublic(board, true);
}

/**
 * Fork every drawable drill in a session onto one board as sequence slides.
 * Skips cooldown / empty diagrams. Caps at BOARD_DIAGRAM_MAX_FRAMES.
 */
export async function createForkSessionBoard(userId: string, body: any, isSuperAdmin: boolean) {
  await assertCanCreateBoards(userId);

  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
  if (!sessionId) {
    throw new TacticalBoardError(400, 'SESSION_REQUIRED', 'sessionId is required');
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      generatedBy: true,
      savedToVault: true,
      gameModelId: true,
      clubId: true,
      ageGroup: true,
      json: true,
      title: true,
    },
  });

  if (!session) {
    throw new TacticalBoardError(404, 'SESSION_NOT_FOUND', 'Session not found');
  }

  const allowed = await canForkSession(userId, session, isSuperAdmin);
  if (!allowed) {
    throw new TacticalBoardError(404, 'SESSION_NOT_FOUND', 'Session not found');
  }

  const drills = getSessionDrills(session.json);
  const frames: NonNullable<WebDiagramV1['sequence']>['frames'] = [];
  let pitch: WebDiagramV1['pitch'] | null = null;

  for (const drill of drills) {
    if (frames.length >= BOARD_DIAGRAM_MAX_FRAMES) break;
    if (String(drill?.drillType || '').toUpperCase() === 'COOLDOWN') continue;
    const web = await tryResolveForkDiagram(drill, session.ageGroup);
    if (!web) continue;
    if (!pitch) pitch = web.pitch;
    const n = frames.length + 1;
    const title =
      (typeof drill?.title === 'string' && drill.title.trim()) ||
      (typeof drill?.name === 'string' && drill.name.trim()) ||
      `Drill ${n}`;
    const note =
      typeof drill?.drillType === 'string' ? String(drill.drillType).replace(/_/g, ' ') : undefined;
    frames.push(slideFromDiagram(web, `f-${n}`, title, note));
  }

  if (!pitch || frames.length === 0) {
    throw new TacticalBoardError(
      400,
      'NO_PLAYERS',
      'None of the drills have a diagram that can open on the board'
    );
  }

  const first = frames[0];
  const diagram: WebDiagramV1 = {
    pitch: { ...pitch, variant: 'FULL', orientation: 'HORIZONTAL' },
    players: first.players,
    arrows: first.arrows,
    areas: first.areas,
    labels: first.labels,
    balls: first.balls,
    goals: first.goals,
    coach: first.coach,
    cones: first.cones,
    elements: first.elements,
    sequence: { activeFrameId: first.id, frames },
  };

  const validated = parseWebDiagramV1(diagram);
  if (!validated.ok) {
    throw new TacticalBoardError(400, 'INVALID_DIAGRAM', validated.error, validated.details);
  }

  const shareMode = parseShareMode(body?.shareMode);
  const { clubId, gameModelId } = await resolveCreateGameModel({
    userId,
    clientGameModelId: body?.gameModelId,
    forkSessionGameModelId: session.gameModelId,
    shareMode,
  });

  const title =
    typeof body?.title === 'string' && body.title.trim()
      ? normalizeTitle(body.title)
      : normalizeTitle(`${session.title || 'Session'} — slides`);

  const board = await prisma.tacticalBoard.create({
    data: {
      ownerUserId: userId,
      clubId,
      title,
      diagram: validated.diagram as unknown as Prisma.InputJsonValue,
      ageGroup:
        typeof body?.ageGroup === 'string'
          ? body.ageGroup.slice(0, 32)
          : session.ageGroup || null,
      gameModelId,
      shareMode,
      sourceSessionId: session.id,
      sourceDrillKey: 'SESSION',
    },
  });

  return boardPublic(board, true);
}

export async function listOwnedBoards(
  userId: string,
  opts: { cursor?: string | null; limit?: number }
) {
  const take = Math.min(Math.max(opts.limit ?? 50, 1), 50);
  const cursor = decodeBoardCursor(opts.cursor ?? null);

  const where: Prisma.TacticalBoardWhereInput = {
    ownerUserId: userId,
  };

  if (cursor) {
    const cursorDate = new Date(cursor.updatedAt);
    where.AND = [
      {
        OR: [
          { updatedAt: { lt: cursorDate } },
          { updatedAt: cursorDate, id: { lt: cursor.id } },
        ],
      },
    ];
  }

  const rows = await prisma.tacticalBoard.findMany({
    where,
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    select: {
      id: true,
      ownerUserId: true,
      clubId: true,
      title: true,
      ageGroup: true,
      gameModelId: true,
      shareMode: true,
      sourceSessionId: true,
      sourceDrillKey: true,
      createdAt: true,
      updatedAt: true,
      favorited: true,
      diagram: true,
      owner: { select: { name: true, email: true } },
    },
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeBoardCursor(last.updatedAt, last.id) : null;

  const sessionIds = [
    ...new Set(page.map((b) => b.sourceSessionId).filter((id): id is string => Boolean(id))),
  ];
  const sessions = sessionIds.length
    ? await prisma.session.findMany({
        where: { id: { in: sessionIds } },
        select: { id: true, phase: true, zone: true, formationUsed: true, json: true },
      })
    : [];
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  return {
    boards: page.map((b) => {
      const { diagram, owner, ...rest } = b;
      const meta = summarizeBoardCardMeta(diagram);
      const session = b.sourceSessionId ? sessionById.get(b.sourceSessionId) : undefined;
      const sessionJson =
        session?.json && typeof session.json === 'object'
          ? (session.json as Record<string, unknown>)
          : null;
      const jsonAtt =
        typeof sessionJson?.formationAttacking === 'string'
          ? sessionJson.formationAttacking
          : null;
      const jsonDef =
        typeof sessionJson?.formationDefending === 'string'
          ? sessionJson.formationDefending
          : null;
      return {
        ...rest,
        canEdit: true,
        creator: owner ? { name: owner.name, email: owner.email } : null,
        phase: meta.phase || session?.phase || null,
        zone: meta.zone || session?.zone || null,
        channel: meta.channel,
        attFormation: meta.attFormation || jsonAtt || session?.formationUsed || null,
        defFormation: meta.defFormation || jsonDef || null,
        slideCount: meta.slideCount,
      };
    }),
    nextCursor,
  };
}

export async function getBoardForUser(boardId: string, userId: string) {
  const board = await prisma.tacticalBoard.findUnique({ where: { id: boardId } });
  if (!board) {
    throw new TacticalBoardError(404, 'NOT_FOUND', 'Board not found');
  }

  const access = await resolveBoardAccess(board, userId);
  if (!access) {
    throw new TacticalBoardError(404, 'NOT_FOUND', 'Board not found');
  }

  return boardPublic(board, access.canEdit);
}

export async function patchBoard(boardId: string, userId: string, body: any) {
  const board = await prisma.tacticalBoard.findUnique({ where: { id: boardId } });
  if (!board || board.ownerUserId !== userId) {
    throw new TacticalBoardError(404, 'NOT_FOUND', 'Board not found');
  }

  const data: Prisma.TacticalBoardUpdateInput = {};

  if (body?.title !== undefined) {
    data.title = normalizeTitle(body.title);
  }

  if (body?.ageGroup !== undefined) {
    data.ageGroup =
      body.ageGroup === null || body.ageGroup === ''
        ? null
        : String(body.ageGroup).slice(0, 32);
  }

  if (body?.shareMode !== undefined) {
    const shareMode = parseShareMode(body.shareMode);
    if (shareMode === BoardShareMode.CLUB && !board.clubId) {
      // Re-check stamp in case membership was added after create.
      const stamp = await resolveBoardClubStamp(userId);
      if (!stamp.clubId) {
        throw new TacticalBoardError(
          400,
          'CLUB_REQUIRED',
          'shareMode=CLUB requires a club membership'
        );
      }
      data.club = { connect: { id: stamp.clubId } };
      if (stamp.gameModelId) {
        data.gameModelId = stamp.gameModelId;
      }
    }
    data.shareMode = shareMode;
  }

  if (typeof body?.favorited === 'boolean') {
    data.favorited = body.favorited;
  }

  if (body?.diagram !== undefined) {
    const validated = parseWebDiagramV1(body.diagram);
    if (!validated.ok) {
      throw new TacticalBoardError(400, 'INVALID_DIAGRAM', validated.error, validated.details);
    }
    data.diagram = validated.diagram as unknown as Prisma.InputJsonValue;
  }

  if (Object.keys(data).length === 0) {
    throw new TacticalBoardError(400, 'EMPTY_PATCH', 'No valid fields to update');
  }

  const updated = await prisma.tacticalBoard.update({
    where: { id: boardId },
    data,
  });

  return boardPublic(updated, true);
}

export async function deleteBoard(boardId: string, userId: string) {
  const board = await prisma.tacticalBoard.findUnique({
    where: { id: boardId },
    select: { id: true, ownerUserId: true },
  });
  if (!board || board.ownerUserId !== userId) {
    throw new TacticalBoardError(404, 'NOT_FOUND', 'Board not found');
  }
  await prisma.tacticalBoard.delete({ where: { id: boardId } });
  return { ok: true as const };
}
