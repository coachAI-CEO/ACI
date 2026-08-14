/**
 * Tactical Board authz + service matrix (mocked prisma).
 * Covers eng-review test plan paths that don't need a live DB.
 */

jest.mock('../prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    clubMembership: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    tacticalBoard: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    session: { findUnique: jest.fn() },
    club: { findFirst: jest.fn() },
  },
}));

jest.mock('../utils/ref-code', () => ({
  lookupByRefCode: jest.fn(),
}));

import { BoardShareMode, GameModelId } from '@prisma/client';
import { prisma } from '../prisma';
import { lookupByRefCode } from '../utils/ref-code';
import { isTacticalBoardV1Enabled } from '../services/board-club-stamp';
import {
  TacticalBoardError,
  createBlankBoard,
  createForkBoard,
  createForkSessionBoard,
  decodeBoardCursor,
  encodeBoardCursor,
  getBoardForUser,
  listOwnedBoards,
  patchBoard,
  resolveBoardAccess,
} from '../services/tactical-boards';

const mockedPrisma = prisma as any;
const mockedLookup = lookupByRefCode as jest.MockedFunction<typeof lookupByRefCode>;

function boardRow(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-08-12T12:00:00.000Z');
  return {
    id: 'board-1',
    ownerUserId: 'owner-1',
    clubId: 'club-1',
    title: 'Untitled board',
    diagram: {
      pitch: { variant: 'HALF', orientation: 'HORIZONTAL', showZones: false },
      players: [],
      arrows: [],
      areas: [],
      labels: [],
    },
    ageGroup: null,
    gameModelId: GameModelId.POSSESSION,
    shareMode: BoardShareMode.PRIVATE,
    sourceSessionId: null,
    sourceDrillKey: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.TACTICAL_BOARD_V1;
});

describe('isTacticalBoardV1Enabled', () => {
  test('true unless env is 0', () => {
    delete process.env.TACTICAL_BOARD_V1;
    expect(isTacticalBoardV1Enabled()).toBe(true);
    process.env.TACTICAL_BOARD_V1 = '1';
    expect(isTacticalBoardV1Enabled()).toBe(true);
    process.env.TACTICAL_BOARD_V1 = '0';
    expect(isTacticalBoardV1Enabled()).toBe(false);
  });
});

describe('board list cursor', () => {
  test('round-trips', () => {
    const d = new Date('2026-08-12T12:00:00.000Z');
    const encoded = encodeBoardCursor(d, 'abc');
    expect(decodeBoardCursor(encoded)).toEqual({
      updatedAt: d.toISOString(),
      id: 'abc',
    });
  });

  test('invalid cursor → null', () => {
    expect(decodeBoardCursor('not-valid')).toBeNull();
    expect(decodeBoardCursor(null)).toBeNull();
  });
});

describe('resolveBoardAccess', () => {
  test('owner can edit', async () => {
    await expect(
      resolveBoardAccess(
        { ownerUserId: 'u1', clubId: 'c1', shareMode: BoardShareMode.PRIVATE },
        'u1'
      )
    ).resolves.toEqual({ canEdit: true });
  });

  test('peer on PRIVATE → null (404)', async () => {
    await expect(
      resolveBoardAccess(
        { ownerUserId: 'u1', clubId: 'c1', shareMode: BoardShareMode.PRIVATE },
        'u2'
      )
    ).resolves.toBeNull();
  });

  test('same-club peer on CLUB → view only', async () => {
    mockedPrisma.clubMembership.findUnique
      .mockResolvedValueOnce({ id: 'own-m' }) // owner still in club
      .mockResolvedValueOnce({ id: 'view-m' }); // viewer membership
    await expect(
      resolveBoardAccess(
        { ownerUserId: 'u1', clubId: 'c1', shareMode: BoardShareMode.CLUB },
        'u2'
      )
    ).resolves.toEqual({ canEdit: false });
  });

  test('ex-member owner CLUB board → PRIVATE for peers', async () => {
    mockedPrisma.clubMembership.findUnique.mockResolvedValueOnce(null); // owner left
    await expect(
      resolveBoardAccess(
        { ownerUserId: 'u1', clubId: 'c1', shareMode: BoardShareMode.CLUB },
        'u2'
      )
    ).resolves.toBeNull();
  });

  test('cross-club peer → null', async () => {
    mockedPrisma.clubMembership.findUnique
      .mockResolvedValueOnce({ id: 'own-m' })
      .mockResolvedValueOnce(null);
    await expect(
      resolveBoardAccess(
        { ownerUserId: 'u1', clubId: 'c1', shareMode: BoardShareMode.CLUB },
        'u2'
      )
    ).resolves.toBeNull();
  });
});

describe('createBlankBoard', () => {
  test('403 when user has no coach/membership/admin', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({
      role: 'FREE',
      adminRole: null,
    });
    mockedPrisma.clubMembership.findFirst.mockResolvedValue(null);
    await expect(createBlankBoard('u1', {})).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  test('400 when shareMode=CLUB without club stamp', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({
      role: 'COACH',
      adminRole: null,
      organizationName: null,
    });
    mockedPrisma.clubMembership.findMany.mockResolvedValue([]);
    mockedPrisma.club.findFirst.mockResolvedValue(null);

    await expect(
      createBlankBoard('u1', { shareMode: 'CLUB', gameModelId: 'POSSESSION' })
    ).rejects.toMatchObject({ status: 400, code: 'CLUB_REQUIRED' });
  });

  test('stamps club gameModelId and creates blank', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({
      role: 'COACH',
      adminRole: null,
    });
    mockedPrisma.clubMembership.findMany.mockResolvedValue([
      {
        role: 'COACH',
        clubId: 'club-1',
        createdAt: new Date(),
        club: { id: 'club-1', name: 'Rocklin', gameModelId: GameModelId.ROCKLIN_FC, active: true },
      },
    ]);
    const created = boardRow({
      gameModelId: GameModelId.ROCKLIN_FC,
      clubId: 'club-1',
    });
    mockedPrisma.tacticalBoard.create.mockResolvedValue(created);

    const board = await createBlankBoard('owner-1', { title: 'Test' });
    expect(board.canEdit).toBe(true);
    expect(board.gameModelId).toBe(GameModelId.ROCKLIN_FC);
    expect(board.clubId).toBe('club-1');
    expect(mockedPrisma.tacticalBoard.create).toHaveBeenCalled();
  });
});

describe('getBoardForUser / patchBoard', () => {
  test('GET peer PRIVATE → 404', async () => {
    mockedPrisma.tacticalBoard.findUnique.mockResolvedValue(
      boardRow({ shareMode: BoardShareMode.PRIVATE })
    );
    await expect(getBoardForUser('board-1', 'other')).rejects.toMatchObject({
      status: 404,
    });
  });

  test('PATCH non-owner → 404', async () => {
    mockedPrisma.tacticalBoard.findUnique.mockResolvedValue(boardRow());
    await expect(
      patchBoard('board-1', 'other', { title: 'x' })
    ).rejects.toMatchObject({ status: 404 });
  });

  test('PATCH Zod reject over player cap', async () => {
    mockedPrisma.tacticalBoard.findUnique.mockResolvedValue(boardRow());
    const players = Array.from({ length: 31 }, (_, i) => ({
      id: `p${i}`,
      team: 'ATT',
      x: 10,
      y: 10,
    }));
    await expect(
      patchBoard('board-1', 'owner-1', {
        diagram: {
          pitch: { variant: 'HALF', orientation: 'HORIZONTAL' },
          players,
          arrows: [],
          areas: [],
          labels: [],
        },
      })
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_DIAGRAM' });
  });

  test('PATCH owner diagram OK', async () => {
    mockedPrisma.tacticalBoard.findUnique.mockResolvedValue(boardRow());
    const diagram = {
      pitch: { variant: 'HALF' as const, orientation: 'HORIZONTAL' as const },
      players: Array.from({ length: 8 }, (_, i) => ({
        id: `p${i}`,
        team: 'ATT' as const,
        number: i + 1,
        x: 10 + i,
        y: 20,
      })),
      arrows: [
        {
          from: { playerId: 'p0' },
          to: { playerId: 'p1' },
          type: 'pass' as const,
          style: 'solid' as const,
          weight: 'normal' as const,
        },
      ],
      areas: [],
      labels: [],
    };
    mockedPrisma.tacticalBoard.update.mockResolvedValue(
      boardRow({ diagram, title: 'Saved' })
    );
    const board = await patchBoard('board-1', 'owner-1', { diagram, title: 'Saved' });
    expect(board.title).toBe('Saved');
    expect((board.diagram as any).players).toHaveLength(8);
  });
});

describe('createForkBoard authz', () => {
  const sessionBase = {
    id: 'sess-1',
    generatedBy: 'owner-1',
    savedToVault: false,
    gameModelId: GameModelId.POSSESSION,
    ageGroup: 'U12',
    title: 'Session',
    json: {
      drills: [
        {
          refCode: 'D-ABCD',
          title: 'Rondo',
          diagramV1: {
            pitch: { variant: 'THIRD', orientation: 'HORIZONTAL' },
            players: [
              { id: 'a', team: 'ATT', x: 30, y: 40, number: 8 },
              { id: 'b', team: 'DEF', x: 50, y: 40, number: 4 },
            ],
            arrows: [
              {
                from: { playerId: 'a' },
                to: { playerId: 'b' },
                type: 'pass',
                style: 'solid',
                weight: 'normal',
              },
            ],
            areas: [],
            labels: [],
          },
        },
      ],
    },
  };

  beforeEach(() => {
    mockedPrisma.user.findUnique.mockResolvedValue({
      role: 'COACH',
      adminRole: null,
    });
    mockedPrisma.clubMembership.findMany.mockResolvedValue([]);
    mockedPrisma.club.findFirst.mockResolvedValue(null);
  });

  test('outsider non-vault → 404', async () => {
    mockedPrisma.session.findUnique.mockResolvedValue({
      ...sessionBase,
      generatedBy: 'someone-else',
      savedToVault: false,
    });
    await expect(
      createForkBoard('owner-1', { sessionId: 'sess-1', drillIndex: 0 }, false)
    ).rejects.toMatchObject({ status: 404 });
  });

  test('owner FORK remaps session axes and shows FULL pitch', async () => {
    mockedPrisma.session.findUnique.mockResolvedValue(sessionBase);
    mockedPrisma.tacticalBoard.create.mockImplementation(async ({ data }: any) =>
      boardRow({
        ...data,
        id: 'forked-1',
        diagram: data.diagram,
      })
    );

    const board = await createForkBoard(
      'owner-1',
      { sessionId: 'sess-1', drillIndex: 0, gameModelId: 'POSSESSION' },
      false
    );
    expect(board.sourceSessionId).toBe('sess-1');
    expect(board.sourceDrillKey).toBe('D-ABCD');
    expect((board.diagram as any).pitch.variant).toBe('FULL');
    expect((board.diagram as any).pitch.format).toBe('9V9');
    const players = (board.diagram as any).players;
    expect(players.length).toBeGreaterThanOrEqual(2);
    expect(players.find((p: any) => p.id === 'a')).toMatchObject({ x: 40, y: 30 });
    expect(players.find((p: any) => p.id === 'b')).toMatchObject({ x: 40, y: 50 });
  });

  test('same-club vault peer can FORK', async () => {
    mockedPrisma.session.findUnique.mockResolvedValue({
      ...sessionBase,
      generatedBy: 'other-coach',
      savedToVault: true,
    });
    // canForkSession membership check
    mockedPrisma.clubMembership.findMany
      .mockResolvedValueOnce([
        { club: { gameModelId: GameModelId.POSSESSION, active: true } },
      ])
      // resolveBoardClubStamp
      .mockResolvedValueOnce([]);
    mockedPrisma.tacticalBoard.create.mockImplementation(async ({ data }: any) =>
      boardRow({ ...data, id: 'forked-2' })
    );

    const board = await createForkBoard(
      'owner-1',
      { sessionId: 'sess-1', drillRefCode: 'D-ABCD', gameModelId: 'POSSESSION' },
      false
    );
    expect(board.id).toBe('forked-2');
  });

  test('thin diagram triggers vault lookup', async () => {
    mockedPrisma.session.findUnique.mockResolvedValue({
      ...sessionBase,
      json: {
        drills: [
          {
            refCode: 'D-THIN',
            title: 'Thin',
            diagramV1: {
              pitch: { variant: 'HALF', orientation: 'HORIZONTAL' },
              players: [{ id: 'a', team: 'ATT', x: 10, y: 10 }],
              arrows: [],
              areas: [],
              labels: [],
            },
          },
        ],
      },
    });
    mockedLookup.mockResolvedValue({
      type: 'drill',
      data: {
        refCode: 'D-THIN',
        diagramV1: {
          pitch: { variant: 'HALF', orientation: 'HORIZONTAL' },
          players: [
            { id: 'a', team: 'ATT', x: 10, y: 10 },
            { id: 'b', team: 'DEF', x: 40, y: 40 },
          ],
          arrows: [
            {
              from: { playerId: 'a' },
              to: { playerId: 'b' },
              type: 'pass',
              style: 'solid',
              weight: 'normal',
            },
          ],
          areas: [],
          labels: [],
        },
      },
    });
    mockedPrisma.tacticalBoard.create.mockImplementation(async ({ data }: any) =>
      boardRow({ ...data, id: 'forked-thin' })
    );

    const board = await createForkBoard(
      'owner-1',
      { sessionId: 'sess-1', drillIndex: 0, gameModelId: 'POSSESSION' },
      false
    );
    expect(mockedLookup).toHaveBeenCalledWith('D-THIN');
    expect((board.diagram as any).arrows.length).toBe(1);
    expect((board.diagram as any).players).toHaveLength(2);
  });

  test('FORK_SESSION builds one slide per drawable drill', async () => {
    mockedPrisma.session.findUnique.mockResolvedValue({
      ...sessionBase,
      json: {
        drills: [
          sessionBase.json.drills[0],
          {
            refCode: 'D-WARM',
            title: 'Rondo warmup',
            drillType: 'WARMUP',
            diagramV1: {
              pitch: { variant: 'HALF', orientation: 'HORIZONTAL' },
              players: [
                { id: 'w1', team: 'ATT', x: 20, y: 50, number: 6 },
                { id: 'w2', team: 'DEF', x: 40, y: 50, number: 4 },
              ],
              arrows: [
                {
                  from: { playerId: 'w1' },
                  to: { playerId: 'w2' },
                  type: 'pass',
                  style: 'solid',
                  weight: 'normal',
                },
              ],
              areas: [],
              labels: [],
            },
          },
          {
            refCode: 'D-COOL',
            title: 'Stretch',
            drillType: 'COOLDOWN',
            diagramV1: {
              pitch: { variant: 'HALF', orientation: 'HORIZONTAL' },
              players: [{ id: 'c1', team: 'NEUTRAL', x: 50, y: 50, number: 1 }],
              arrows: [],
              areas: [],
              labels: [],
            },
          },
        ],
      },
    });
    mockedPrisma.tacticalBoard.create.mockImplementation(async ({ data }: any) =>
      boardRow({ ...data, id: 'forked-session', diagram: data.diagram })
    );

    const board = await createForkSessionBoard(
      'owner-1',
      { sessionId: 'sess-1', gameModelId: 'POSSESSION' },
      false
    );
    const seq = (board.diagram as any).sequence;
    expect(board.sourceDrillKey).toBe('SESSION');
    expect(seq.frames).toHaveLength(2);
    expect(seq.frames[0].title).toBe("Rondo");
    expect(seq.frames[1].title).toBe("Rondo warmup");
    expect(seq.activeFrameId).toBe('f-1');
    expect((board.diagram as any).pitch.variant).toBe('FULL');
  });
});

describe('listOwnedBoards pagination', () => {
  test('returns nextCursor when more rows exist', async () => {
    const rows = Array.from({ length: 3 }, (_, i) =>
      boardRow({
        id: `b${i}`,
        updatedAt: new Date(`2026-08-0${3 - i}T12:00:00.000Z`),
      })
    );
    mockedPrisma.tacticalBoard.findMany.mockResolvedValue(rows);
    const result = await listOwnedBoards('owner-1', { limit: 2 });
    expect(result.boards).toHaveLength(2);
    expect(result.nextCursor).toBeTruthy();
    expect(decodeBoardCursor(result.nextCursor)).toMatchObject({ id: 'b1' });
  });
});

describe('TacticalBoardError shape', () => {
  test('carries status/code', () => {
    const err = new TacticalBoardError(404, 'NOT_FOUND', 'Board not found');
    expect(err.status).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });
});
