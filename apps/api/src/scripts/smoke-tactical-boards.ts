/**
 * Live DB smoke for Tactical Board success criteria.
 * Usage (from apps/api):
 *   TACTICAL_BOARD_V1=1 pnpm exec tsx src/scripts/smoke-tactical-boards.ts
 */
import { BoardShareMode, GameModelId, UserRole } from '@prisma/client';
import { prisma } from '../prisma';
import {
  createBlankBoard,
  createForkBoard,
  deleteBoard,
  getBoardForUser,
  listOwnedBoards,
  patchBoard,
} from '../services/tactical-boards';

async function main() {
  process.env.TACTICAL_BOARD_V1 = '1';
  const stamp = `smoke-board-${Date.now()}`;
  const email = `${stamp}@example.com`;

  console.log('[smoke] creating users + club…');
  const club = await prisma.club.create({
    data: {
      name: `Smoke Club ${stamp}`,
      code: `SMK${Date.now().toString(36).slice(-4).toUpperCase()}`,
      gameModelId: GameModelId.POSSESSION,
      active: true,
    },
  });

  const owner = await prisma.user.create({
    data: {
      email,
      name: 'Smoke Owner',
      role: UserRole.COACH,
      passwordHash: 'smoke-not-used',
    },
  });
  const peer = await prisma.user.create({
    data: {
      email: `${stamp}-peer@example.com`,
      name: 'Smoke Peer',
      role: UserRole.COACH,
      passwordHash: 'smoke-not-used',
    },
  });

  await prisma.clubMembership.createMany({
    data: [
      { userId: owner.id, clubId: club.id, role: 'COACH' },
      { userId: peer.id, clubId: club.id, role: 'COACH' },
    ],
  });

  let boardId: string | null = null;
  let sessionId: string | null = null;

  try {
    // 1) BLANK create + stamp
    const blank = await createBlankBoard(owner.id, { title: 'Smoke Blank' });
    boardId = blank.id;
    if (blank.gameModelId !== GameModelId.POSSESSION || blank.clubId !== club.id) {
      throw new Error(`stamp failed: ${blank.gameModelId} / ${blank.clubId}`);
    }
    console.log('[smoke] ✓ BLANK create + club gameModel stamp');

    // 2) add ≥8 players + arrow, save, reload
    const players = Array.from({ length: 8 }, (_, i) => ({
      id: `p${i}`,
      team: (i % 2 === 0 ? 'ATT' : 'DEF') as 'ATT' | 'DEF',
      number: i + 1,
      x: 10 + i * 8,
      y: 40,
    }));
    const diagram = {
      pitch: { variant: 'HALF' as const, orientation: 'HORIZONTAL' as const, showZones: false },
      players,
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
      labels: [{ text: 'press', x: 50, y: 50 }],
    };
    await patchBoard(boardId, owner.id, {
      diagram,
      shareMode: BoardShareMode.CLUB,
      title: 'Smoke Saved',
    });
    const reloaded = await getBoardForUser(boardId, owner.id);
    if ((reloaded.diagram as any).players.length !== 8) {
      throw new Error('reload player count mismatch');
    }
    if (!reloaded.canEdit) throw new Error('owner should canEdit');
    console.log('[smoke] ✓ save + reload (8 players + arrow)');

    // 3) club peer view / private 404
    const peerView = await getBoardForUser(boardId, peer.id);
    if (peerView.canEdit) throw new Error('peer should be view-only');
    console.log('[smoke] ✓ club peer view-only');

    await patchBoard(boardId, owner.id, { shareMode: BoardShareMode.PRIVATE });
    let privateBlocked = false;
    try {
      await getBoardForUser(boardId, peer.id);
    } catch (e: any) {
      privateBlocked = e?.status === 404;
    }
    if (!privateBlocked) throw new Error('PRIVATE board should 404 for peer');
    console.log('[smoke] ✓ PRIVATE → peer 404');

    // 4) FORK from session
    const session = await prisma.session.create({
      data: {
        title: `Smoke Session ${stamp}`,
        gameModelId: GameModelId.POSSESSION,
        ageGroup: 'U12',
        generatedBy: owner.id,
        savedToVault: false,
        json: {
          drills: [
            {
              refCode: 'D-SMOK',
              title: 'Smoke Drill',
              diagramV1: {
                pitch: { variant: 'THIRD', orientation: 'HORIZONTAL' },
                players: [
                  { id: 'a', team: 'ATT', x: 25, y: 30, number: 9 },
                  { id: 'b', team: 'DEF', x: 55, y: 35, number: 5 },
                ],
                arrows: [
                  {
                    from: { playerId: 'a' },
                    to: { playerId: 'b' },
                    type: 'run',
                    style: 'dashed',
                    weight: 'normal',
                  },
                ],
                areas: [],
                labels: [],
              },
            },
          ],
        },
      },
    });
    sessionId = session.id;

    const forked = await createForkBoard(
      owner.id,
      { sessionId: session.id, drillIndex: 0 },
      false
    );
    if ((forked.diagram as any).pitch.variant !== 'THIRD') {
      throw new Error(`FORK lost THIRD: ${(forked.diagram as any).pitch.variant}`);
    }
    if (forked.sourceDrillKey !== 'D-SMOK') {
      throw new Error(`bad sourceDrillKey: ${forked.sourceDrillKey}`);
    }
    console.log('[smoke] ✓ FORK_DRILL preserves THIRD + positions');

    // 5) list pagination
    const listed = await listOwnedBoards(owner.id, { limit: 50 });
    if (!listed.boards.some((b) => b.id === boardId)) {
      throw new Error('owner list missing board');
    }
    console.log('[smoke] ✓ owner list includes board');

    console.log('[smoke] ALL SUCCESS CRITERIA PASSED');
  } finally {
    console.log('[smoke] cleanup…');
    if (boardId) {
      try {
        await deleteBoard(boardId, owner.id);
      } catch {
        await prisma.tacticalBoard.deleteMany({ where: { ownerUserId: owner.id } });
      }
    }
    await prisma.tacticalBoard.deleteMany({ where: { ownerUserId: owner.id } });
    if (sessionId) {
      await prisma.session.delete({ where: { id: sessionId } }).catch(() => undefined);
    }
    await prisma.clubMembership.deleteMany({ where: { clubId: club.id } });
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, peer.id] } } });
    await prisma.club.delete({ where: { id: club.id } }).catch(() => undefined);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('[smoke] FAILED', e);
    await prisma.$disconnect();
    process.exit(1);
  });
