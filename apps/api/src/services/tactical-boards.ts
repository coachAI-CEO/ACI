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
import { BOARD_TITLE_MAX_LEN, parseWebDiagramV1 } from './board-diagram-schema';
import {
  DEFAULT_MATCH_BOARD_DIAGRAM,
  extractRawDiagramFromDrill,
  isDiagramThinForFork,
  toWebDiagramV1,
  type WebDiagramV1,
} from './web-diagram-v1';

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
  if (value === undefined || value === null || value === '') return 'Untitled board';
  const title = String(value).trim().slice(0, BOARD_TITLE_MAX_LEN);
  return title || 'Untitled board';
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
  session: { generatedBy: string | null; savedToVault: boolean; gameModelId: GameModelId },
  isSuperAdmin: boolean
): Promise<boolean> {
  if (isSuperAdmin) return true;
  if (session.generatedBy && session.generatedBy === userId) return true;

  if (!session.savedToVault) return false;

  const memberships = await prisma.clubMembership.findMany({
    where: { userId },
    select: {
      club: { select: { gameModelId: true, active: true } },
    },
  });

  return memberships.some(
    (m) => m.club?.active !== false && m.club.gameModelId === session.gameModelId
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

async function resolveForkDiagram(drill: any): Promise<WebDiagramV1> {
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

  const validated = parseWebDiagramV1(web);
  if (!validated.ok) {
    throw new TacticalBoardError(400, 'INVALID_DIAGRAM', validated.error, validated.details);
  }
  return validated.diagram;
}

export async function createBlankBoard(userId: string, body: any) {
  await assertCanCreateBoards(userId);
  const shareMode = parseShareMode(body?.shareMode);
  const { clubId, gameModelId } = await resolveCreateGameModel({
    userId,
    clientGameModelId: body?.gameModelId,
    shareMode,
  });

  const diagramCheck = parseWebDiagramV1(DEFAULT_MATCH_BOARD_DIAGRAM);
  if (!diagramCheck.ok) {
    throw new TacticalBoardError(500, 'BLANK_INVALID', diagramCheck.error);
  }

  const board = await prisma.tacticalBoard.create({
    data: {
      ownerUserId: userId,
      clubId,
      title: normalizeTitle(body?.title),
      diagram: diagramCheck.diagram as unknown as Prisma.InputJsonValue,
      ageGroup: typeof body?.ageGroup === 'string' ? body.ageGroup.slice(0, 32) : null,
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

  const diagram = await resolveForkDiagram(picked.drill);
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
    },
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeBoardCursor(last.updatedAt, last.id) : null;

  return {
    boards: page.map((b) => ({
      ...b,
      canEdit: true,
    })),
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
