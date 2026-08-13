/**
 * Interactive editor scenario — simulates the actions a coach takes on a board:
 * create → add players → move → arrows → labels → rename → share CLUB → save → reload.
 *
 * From apps/api:
 *   TACTICAL_BOARD_V1=1 pnpm exec ts-node --transpile-only src/scripts/scenario-tactical-board-editor.ts
 */
import { BoardShareMode, GameModelId, UserRole } from '@prisma/client';
import { prisma } from '../prisma';
import { hashPassword } from '../services/auth';
import {
  createBlankBoard,
  deleteBoard,
  getBoardForUser,
  patchBoard,
} from '../services/tactical-boards';
import type { WebDiagramV1 } from '../services/web-diagram-v1';

function step(n: number, label: string) {
  console.log(`\n[step ${n}] ${label}`);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  process.env.TACTICAL_BOARD_V1 = '1';
  const stamp = `scenario-${Date.now()}`;
  const password = 'ScenarioTest123!';

  step(0, 'Setup coach + club');
  const club = await prisma.club.create({
    data: {
      name: `Scenario Club ${stamp}`,
      code: `SC${Date.now().toString(36).slice(-4).toUpperCase()}`,
      gameModelId: GameModelId.POSSESSION,
      active: true,
    },
  });
  const owner = await prisma.user.create({
    data: {
      email: `${stamp}@example.com`,
      name: 'Scenario Coach',
      role: UserRole.COACH,
      passwordHash: await hashPassword(password),
      emailVerified: true,
    },
  });
  await prisma.clubMembership.create({
    data: { userId: owner.id, clubId: club.id, role: 'COACH' },
  });
  console.log(`  user=${owner.email} club=${club.name}`);

  let boardId: string | null = null;

  try {
    step(1, 'Create blank board (New board)');
    const blank = await createBlankBoard(owner.id, { title: 'Untitled' });
    boardId = blank.id;
    assert(blank.clubId === club.id, 'expected club stamp');
    assert((blank.diagram as any).players.length === 22, 'blank should start with default formations');
    assert((blank.diagram as any).pitch?.variant === 'FULL', 'blank should start FULL pitch');
    assert((blank.diagram as any).pitch?.orientation === 'HORIZONTAL', 'blank should start HORIZONTAL');
    console.log(`  boardId=${boardId}`);

    let diagram = blank.diagram as unknown as WebDiagramV1;

    step(2, 'Add 8 players (tool: Add player ×8)');
    const players = [
      { id: 'att-1', team: 'ATT' as const, number: 9, x: 70, y: 50 },
      { id: 'att-2', team: 'ATT' as const, number: 10, x: 55, y: 35 },
      { id: 'att-3', team: 'ATT' as const, number: 7, x: 55, y: 65 },
      { id: 'att-4', team: 'ATT' as const, number: 8, x: 40, y: 50 },
      { id: 'def-1', team: 'DEF' as const, number: 4, x: 25, y: 40 },
      { id: 'def-2', team: 'DEF' as const, number: 5, x: 25, y: 60 },
      { id: 'def-3', team: 'DEF' as const, number: 6, x: 35, y: 50 },
      { id: 'def-4', team: 'DEF' as const, number: 2, x: 20, y: 20 },
    ];
    diagram = { ...diagram, players };
    let saved = await patchBoard(boardId, owner.id, { diagram });
    assert((saved.diagram as any).players.length === 8, 'expected 8 players');
    console.log('  players=', (saved.diagram as any).players.map((p: any) => `#${p.number}`).join(' '));

    step(3, 'Move striker (drag #9 to final third)');
    diagram = saved.diagram as unknown as WebDiagramV1;
    diagram = {
      ...diagram,
      players: diagram.players.map((p) =>
        p.id === 'att-1' ? { ...p, x: 82, y: 48 } : p
      ),
    };
    saved = await patchBoard(boardId, owner.id, { diagram });
    const moved = (saved.diagram as any).players.find((p: any) => p.id === 'att-1');
    assert(moved?.x === 82, `move failed x=${moved?.x}`);
    console.log(`  #9 now at (${moved.x}, ${moved.y})`);

    step(4, 'Add pass + run arrows');
    diagram = saved.diagram as unknown as WebDiagramV1;
    diagram = {
      ...diagram,
      arrows: [
        {
          from: { playerId: 'att-4' },
          to: { playerId: 'att-2' },
          type: 'pass',
          style: 'solid',
          weight: 'normal',
        },
        {
          from: { playerId: 'att-2' },
          to: { playerId: 'att-1' },
          type: 'run',
          style: 'dashed',
          weight: 'normal',
        },
        {
          from: { playerId: 'def-3' },
          to: { playerId: 'att-4' },
          type: 'press',
          style: 'solid',
          weight: 'bold',
        },
      ],
    };
    saved = await patchBoard(boardId, owner.id, { diagram });
    assert((saved.diagram as any).arrows.length === 3, 'expected 3 arrows');
    console.log(
      '  arrows=',
      (saved.diagram as any).arrows.map((a: any) => a.type).join(', ')
    );

    step(5, 'Add text labels');
    diagram = saved.diagram as unknown as WebDiagramV1;
    diagram = {
      ...diagram,
      labels: [
        { text: 'Third-man run', x: 60, y: 28 },
        { text: 'Press trigger', x: 32, y: 72 },
      ],
    };
    saved = await patchBoard(boardId, owner.id, { diagram });
    assert((saved.diagram as any).labels.length === 2, 'expected 2 labels');
    console.log(
      '  labels=',
      (saved.diagram as any).labels.map((l: any) => `"${l.text}"`).join(', ')
    );

    step(6, 'Rename board + share with club');
    saved = await patchBoard(boardId, owner.id, {
      title: 'U12 Attacking Combo',
      shareMode: BoardShareMode.CLUB,
    });
    assert(saved.title === 'U12 Attacking Combo', 'title not saved');
    assert(saved.shareMode === BoardShareMode.CLUB, 'shareMode not CLUB');
    console.log(`  title="${saved.title}" share=${saved.shareMode}`);

    step(7, 'Reload board (Save → refresh)');
    const reloaded = await getBoardForUser(boardId, owner.id);
    assert(reloaded.canEdit === true, 'owner should edit');
    assert((reloaded.diagram as any).players.length === 8, 'reload lost players');
    assert((reloaded.diagram as any).arrows.length === 3, 'reload lost arrows');
    assert((reloaded.diagram as any).labels.length === 2, 'reload lost labels');
    assert(reloaded.title === 'U12 Attacking Combo', 'reload lost title');
    console.log('  reload OK — players/arrows/labels/title intact');

    step(8, 'Remove a player (delete #2)');
    diagram = reloaded.diagram as unknown as WebDiagramV1;
    diagram = {
      ...diagram,
      players: diagram.players.filter((p) => p.id !== 'def-4'),
      arrows: diagram.arrows.filter(
        (a) => a.from.playerId !== 'def-4' && a.to.playerId !== 'def-4'
      ),
    };
    saved = await patchBoard(boardId, owner.id, { diagram });
    assert((saved.diagram as any).players.length === 7, 'expected 7 after remove');
    console.log('  players remaining=', (saved.diagram as any).players.length);

    console.log('\n════════════════════════════════════════');
    console.log(' SCENARIO PASSED');
    console.log(` board: ${boardId}`);
    console.log(` login: ${owner.email} / ${password}`);
    console.log(` open:  http://localhost:3000/board/${boardId}`);
    console.log('════════════════════════════════════════\n');
  } finally {
    console.log('[cleanup]');
    if (boardId) {
      try {
        await deleteBoard(boardId, owner.id);
      } catch {
        await prisma.tacticalBoard.deleteMany({ where: { ownerUserId: owner.id } });
      }
    }
    await prisma.clubMembership.deleteMany({ where: { clubId: club.id } });
    await prisma.user.delete({ where: { id: owner.id } }).catch(() => undefined);
    await prisma.club.delete({ where: { id: club.id } }).catch(() => undefined);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('\nSCENARIO FAILED', e);
    await prisma.$disconnect();
    process.exit(1);
  });
