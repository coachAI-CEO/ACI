/**
 * Drawing tools + object moves on tactical boards (mocked service layer).
 * Complements live script: pnpm run scenario:board-drawing
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
import { parseWebDiagramV1 } from '../services/board-diagram-schema';
import { createBlankBoard, getBoardForUser, patchBoard } from '../services/tactical-boards';
import { DEFAULT_MATCH_BOARD_DIAGRAM } from '../services/web-diagram-v1';
import type { WebDiagramV1 } from '../services/web-diagram-v1';

const mockedPrisma = prisma as any;

function boardRow(diagram: WebDiagramV1, overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: 'board-drawing',
    ownerUserId: 'coach-1',
    clubId: 'club-1',
    title: 'Drawing board',
    diagram,
    ageGroup: 'U14',
    gameModelId: GameModelId.POSSESSION,
    shareMode: BoardShareMode.PRIVATE,
    sourceSessionId: null,
    sourceDrillKey: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('Tactical board drawing + objects', () => {
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
          name: 'Drawing FC',
          gameModelId: GameModelId.POSSESSION,
          active: true,
        },
      },
    ]);
  });

  test('default match diagram validates (11v11 + ball + format)', () => {
    const parsed = parseWebDiagramV1(DEFAULT_MATCH_BOARD_DIAGRAM);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.diagram.players).toHaveLength(22);
    expect(parsed.diagram.balls?.length).toBeGreaterThanOrEqual(1);
    expect(parsed.diagram.pitch.format).toBe('11V11');
    expect(parsed.diagram.pitch.orientation).toBe('HORIZONTAL');
  });

  test('create → move players/ball → pass lines → shapes → save → reload', async () => {
    const created = boardRow(DEFAULT_MATCH_BOARD_DIAGRAM, { title: 'Untitled board' });
    mockedPrisma.tacticalBoard.create.mockResolvedValue(created);

    const blank = await createBlankBoard('coach-1', { title: 'Untitled board' });
    expect((blank.diagram as any).players.length).toBe(22);

    let diagram = structuredClone(blank.diagram) as unknown as WebDiagramV1;

    // Move ATT #9 and place/move balls
    diagram = {
      ...diagram,
      players: diagram.players.map((p) =>
        p.team === 'ATT' && p.number === 9 ? { ...p, x: 48, y: 36 } : p
      ),
      balls: [
        { x: 50, y: 45 },
        { x: 40, y: 55 },
      ],
    };

    const att8 = diagram.players.find((p) => p.team === 'ATT' && p.number === 8)!;
    const att10 = diagram.players.find((p) => p.team === 'ATT' && p.number === 10)!;
    const att9 = diagram.players.find((p) => p.team === 'ATT' && p.number === 9)!;
    const def6 = diagram.players.find((p) => p.team === 'DEF' && p.number === 6)!;

    diagram = {
      ...diagram,
      arrows: [
        {
          from: { playerId: att8.id },
          to: { playerId: att10.id },
          type: 'pass',
          style: 'solid',
          weight: 'normal',
        },
        {
          from: { playerId: att10.id },
          to: { playerId: att9.id },
          type: 'pass',
          style: 'solid',
          weight: 'normal',
        },
        {
          from: { playerId: att9.id },
          to: { x: 44, y: 20 },
          type: 'run',
          style: 'dashed',
          weight: 'normal',
        },
        {
          from: { playerId: def6.id },
          to: { playerId: att8.id },
          type: 'press',
          style: 'solid',
          weight: 'bold',
        },
        {
          from: { x: 25, y: 30 },
          to: { x: 55, y: 40 },
          type: 'transition',
          style: 'solid',
          weight: 'normal',
        },
      ],
      areas: [
        { shape: 'rect', x: 30, y: 25, width: 20, height: 16, label: 'Press zone' },
        { shape: 'circle', x: 45, y: 50, width: 12, height: 12 },
      ],
      labels: [
        { text: 'Pass & move', x: 55, y: 42 },
        { text: 'Third-man', x: 48, y: 18 },
      ],
    };

    const schema = parseWebDiagramV1(diagram);
    expect(schema.ok).toBe(true);

    const afterDraw = boardRow(diagram, {
      title: 'U14 combo — pass & press',
      shareMode: BoardShareMode.CLUB,
    });
    mockedPrisma.tacticalBoard.findUnique.mockResolvedValue(created);
    mockedPrisma.tacticalBoard.update.mockResolvedValue(afterDraw);

    const saved = await patchBoard('board-drawing', 'coach-1', {
      diagram,
      title: 'U14 combo — pass & press',
      shareMode: BoardShareMode.CLUB,
    });

    expect((saved.diagram as any).arrows).toHaveLength(5);
    expect((saved.diagram as any).arrows.filter((a: any) => a.type === 'pass')).toHaveLength(2);
    expect((saved.diagram as any).areas).toHaveLength(2);
    expect((saved.diagram as any).balls).toHaveLength(2);
    expect((saved.diagram as any).labels).toHaveLength(2);
    expect(saved.shareMode).toBe(BoardShareMode.CLUB);

    // Erase free line + add player
    const trimmed: WebDiagramV1 = {
      ...(saved.diagram as unknown as WebDiagramV1),
      arrows: (saved.diagram as any).arrows.filter((a: any) => a.type !== 'transition'),
      players: [
        ...(saved.diagram as any).players,
        {
          id: 'att-extra',
          number: 14,
          team: 'ATT',
          role: 'CM',
          x: 60,
          y: 58,
        },
      ],
    };
    expect(parseWebDiagramV1(trimmed).ok).toBe(true);

    const finalRow = boardRow(trimmed, {
      title: 'U14 combo — pass & press',
      shareMode: BoardShareMode.CLUB,
    });
    mockedPrisma.tacticalBoard.findUnique.mockResolvedValue(afterDraw);
    mockedPrisma.tacticalBoard.update.mockResolvedValue(finalRow);

    const finalSaved = await patchBoard('board-drawing', 'coach-1', { diagram: trimmed });
    expect((finalSaved.diagram as any).arrows).toHaveLength(4);
    expect((finalSaved.diagram as any).players).toHaveLength(23);

    mockedPrisma.tacticalBoard.findUnique.mockResolvedValue(finalRow);
    const reloaded = await getBoardForUser('board-drawing', 'coach-1');
    expect(reloaded.canEdit).toBe(true);
    expect((reloaded.diagram as any).players).toHaveLength(23);
    expect((reloaded.diagram as any).arrows).toHaveLength(4);
    expect((reloaded.diagram as any).areas[0].shape).toBe('rect');
    expect((reloaded.diagram as any).areas[1].shape).toBe('circle');
  });

  test('rejects oversized drawing payload', () => {
    const tooManyArrows: WebDiagramV1 = {
      ...DEFAULT_MATCH_BOARD_DIAGRAM,
      arrows: Array.from({ length: 41 }, () => ({
        from: { x: 10, y: 10 },
        to: { x: 20, y: 20 },
        type: 'pass' as const,
        style: 'solid' as const,
        weight: 'normal' as const,
      })),
    };
    const parsed = parseWebDiagramV1(tooManyArrows);
    expect(parsed.ok).toBe(false);
  });
});
