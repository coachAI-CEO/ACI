/**
 * Narrative editor scenario (mocked) — documents the coach journey as tests.
 * Complements the live script: pnpm run scenario:board
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

import { BoardShareMode, GameModelId } from '@prisma/client';
import { prisma } from '../prisma';
import { createBlankBoard, getBoardForUser, patchBoard } from '../services/tactical-boards';

const mockedPrisma = prisma as any;

function blankRow(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: 'board-scenario',
    ownerUserId: 'coach-1',
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

describe('Tactical board editor scenario (coach journey)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.user.findUnique.mockResolvedValue({
      role: 'COACH',
      adminRole: null,
    });
    mockedPrisma.clubMembership.findMany.mockResolvedValue([
      {
        role: 'COACH',
        clubId: 'club-1',
        createdAt: new Date(),
        club: {
          id: 'club-1',
          name: 'Scenario FC',
          gameModelId: GameModelId.POSSESSION,
          active: true,
        },
      },
    ]);
  });

  test('create → add players → move → arrows → labels → share → reload', async () => {
    mockedPrisma.tacticalBoard.create.mockResolvedValue(blankRow());

    const created = await createBlankBoard('coach-1', { title: 'Untitled board' });
    expect(created.clubId).toBe('club-1');
    expect((created.diagram as any).players).toHaveLength(0);

    let diagram: any = {
      pitch: { variant: 'HALF', orientation: 'HORIZONTAL', showZones: false },
      players: Array.from({ length: 8 }, (_, i) => ({
        id: `p${i}`,
        team: i < 4 ? 'ATT' : 'DEF',
        number: i + 1,
        x: 20 + i * 8,
        y: 40,
      })),
      arrows: [],
      areas: [],
      labels: [],
    };

    mockedPrisma.tacticalBoard.findUnique.mockResolvedValue(blankRow());
    mockedPrisma.tacticalBoard.update.mockImplementation(async ({ data }: any) =>
      blankRow({
        title: data.title ?? 'Untitled board',
        diagram: data.diagram ?? diagram,
        shareMode: data.shareMode ?? BoardShareMode.PRIVATE,
      })
    );

    let saved = await patchBoard('board-scenario', 'coach-1', { diagram });
    expect((saved.diagram as any).players).toHaveLength(8);

    diagram = {
      ...diagram,
      players: diagram.players.map((p: any) =>
        p.id === 'p0' ? { ...p, x: 88, y: 50 } : p
      ),
    };
    saved = await patchBoard('board-scenario', 'coach-1', { diagram });
    expect((saved.diagram as any).players.find((p: any) => p.id === 'p0').x).toBe(88);

    diagram = {
      ...diagram,
      arrows: [
        {
          from: { playerId: 'p1' },
          to: { playerId: 'p0' },
          type: 'pass',
          style: 'solid',
          weight: 'normal',
        },
        {
          from: { playerId: 'p2' },
          to: { playerId: 'p0' },
          type: 'run',
          style: 'dashed',
          weight: 'normal',
        },
      ],
      labels: [{ text: 'Finish', x: 90, y: 50 }],
    };
    saved = await patchBoard('board-scenario', 'coach-1', { diagram });
    expect((saved.diagram as any).arrows).toHaveLength(2);
    expect((saved.diagram as any).labels).toHaveLength(1);

    saved = await patchBoard('board-scenario', 'coach-1', {
      title: 'Finishing pattern',
      shareMode: 'CLUB',
    });
    expect(saved.title).toBe('Finishing pattern');
    expect(saved.shareMode).toBe(BoardShareMode.CLUB);

    mockedPrisma.tacticalBoard.findUnique.mockResolvedValue(
      blankRow({
        title: 'Finishing pattern',
        shareMode: BoardShareMode.CLUB,
        diagram,
      })
    );
    const reloaded = await getBoardForUser('board-scenario', 'coach-1');
    expect(reloaded.canEdit).toBe(true);
    expect((reloaded.diagram as any).players).toHaveLength(8);
    expect((reloaded.diagram as any).arrows).toHaveLength(2);
  });
});
