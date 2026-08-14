/**
 * Lines scenario — free landings, player-linked passes that stick on move, erase one line.
 *
 * From apps/api:
 *   TACTICAL_BOARD_V1=1 pnpm run scenario:board-lines
 */
import * as fs from 'fs';
import * as path from 'path';
import { BoardShareMode, GameModelId, UserRole } from '@prisma/client';
import { prisma } from '../prisma';
import { hashPassword } from '../services/auth';
import { parseWebDiagramV1 } from '../services/board-diagram-schema';
import {
  arrowFollowsPlayer,
  createLineArrow,
  eraseArrowAtIndex,
  findArrowIndexNearPoint,
  resolveEndpoint,
} from '../services/board-lines';
import {
  createBlankBoard,
  deleteBoard,
  getBoardForUser,
  patchBoard,
} from '../services/tactical-boards';
import type { WebDiagramV1 } from '../services/web-diagram-v1';
import { DEFAULT_MATCH_BOARD_DIAGRAM } from '../services/web-diagram-v1';

function step(n: number, label: string) {
  console.log(`\n[step ${n}] ${label}`);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function samplesDir() {
  return path.resolve(__dirname, '../../samples/tactical-boards');
}

function writeSample(name: string, diagram: unknown, meta?: Record<string, unknown>) {
  const dir = samplesDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(
    file,
    JSON.stringify({ savedAt: new Date().toISOString(), ...meta, diagram }, null, 2) + '\n',
    'utf8'
  );
  console.log(`  wrote ${file}`);
}

async function main() {
  process.env.TACTICAL_BOARD_V1 = '1';
  const stamp = `lines-${Date.now()}`;
  const password = 'LinesTest123!';

  step(0, 'Setup');
  const club = await prisma.club.create({
    data: {
      name: `Lines Club ${stamp}`,
      code: `LN${Date.now().toString(36).slice(-4).toUpperCase()}`,
      gameModelId: GameModelId.POSSESSION,
      active: true,
    },
  });
  const owner = await prisma.user.create({
    data: {
      email: `${stamp}@example.com`,
      name: 'Lines Coach',
      role: UserRole.COACH,
      passwordHash: await hashPassword(password),
      emailVerified: true,
    },
  });
  await prisma.clubMembership.create({
    data: { userId: owner.id, clubId: club.id, role: 'COACH' },
  });

  let boardId: string | null = null;

  try {
    step(1, 'Create board + seed default lineup');
    const blank = await createBlankBoard(owner.id, { title: 'Lines sample' });
    boardId = blank.id;
    const seeded = await patchBoard(boardId, owner.id, {
      diagram: DEFAULT_MATCH_BOARD_DIAGRAM,
    });
    let diagram = seeded.diagram as unknown as WebDiagramV1;
    const att8 = diagram.players.find((p) => p.team === 'ATT' && p.number === 8);
    const att10 = diagram.players.find((p) => p.team === 'ATT' && p.number === 10);
    const att9 = diagram.players.find((p) => p.team === 'ATT' && p.number === 9);
    const def6 = diagram.players.find((p) => p.team === 'DEF' && p.number === 6);
    assert(att8 && att10 && att9 && def6, 'need formation players');

    step(2, 'Add linked pass, free run, free-to-free line, press');
    const linkedPass = createLineArrow({
      fromPlayerId: att8.id,
      toPlayerId: att10.id,
      fromX: att8.x,
      fromY: att8.y,
      toX: att10.x,
      toY: att10.y,
      type: 'pass',
      style: 'solid',
      weight: 'normal',
    });
    const runToSpace = createLineArrow({
      fromPlayerId: att9.id,
      toPlayerId: null,
      fromX: att9.x,
      fromY: att9.y,
      toX: 42,
      toY: 18,
      type: 'run',
      style: 'dashed',
      weight: 'normal',
    });
    const freeLine = createLineArrow({
      fromX: 20,
      fromY: 25,
      toX: 55,
      toY: 40,
      type: 'transition',
      style: 'solid',
      weight: 'normal',
    });
    const press = createLineArrow({
      fromPlayerId: def6.id,
      toPlayerId: att8.id,
      fromX: def6.x,
      fromY: def6.y,
      toX: att8.x,
      toY: att8.y,
      type: 'press',
      style: 'solid',
      weight: 'bold',
    });
    assert(linkedPass && runToSpace && freeLine && press, 'failed to create arrows');

    diagram = {
      ...diagram,
      arrows: [linkedPass, runToSpace, freeLine, press],
    };
    let saved = await patchBoard(boardId, owner.id, { diagram });
    diagram = saved.diagram as unknown as WebDiagramV1;
    assert(diagram.arrows.length === 4, 'expected 4 lines');
    assert(diagram.arrows[0].from.playerId === att8.id, 'pass from should be sticky');
    assert(diagram.arrows[0].to.playerId === att10.id, 'pass to should be sticky');
    assert(diagram.arrows[1].to.x === 42 && !diagram.arrows[1].to.playerId, 'run lands free');
    assert(!diagram.arrows[2].from.playerId && !diagram.arrows[2].to.playerId, 'free line');
    writeSample('05-lines-linked-and-free.json', diagram, {
      boardId,
      note: 'Linked pass + free run landing + free-to-free + press',
    });

    step(3, 'Move linked players — pass endpoints follow');
    diagram = {
      ...diagram,
      players: diagram.players.map((p) => {
        if (p.id === att8.id) return { ...p, x: 58, y: 62 };
        if (p.id === att10.id) return { ...p, x: 45, y: 35 };
        return p;
      }),
    };
    saved = await patchBoard(boardId, owner.id, { diagram });
    diagram = saved.diagram as unknown as WebDiagramV1;

    const moved8 = diagram.players.find((p) => p.id === att8.id)!;
    const moved10 = diagram.players.find((p) => p.id === att10.id)!;
    const pass = diagram.arrows.find((a) => a.type === 'pass')!;
    assert(arrowFollowsPlayer(pass, att8.id), 'pass should follow #8');
    assert(arrowFollowsPlayer(pass, att10.id), 'pass should follow #10');
    const fromPt = resolveEndpoint(pass.from, diagram.players);
    const toPt = resolveEndpoint(pass.to, diagram.players);
    assert(fromPt?.x === moved8.x && fromPt?.y === moved8.y, 'from stuck to #8');
    assert(toPt?.x === moved10.x && toPt?.y === moved10.y, 'to stuck to #10');
    // free run still at fixed landing
    const run = diagram.arrows.find((a) => a.type === 'run')!;
    assert(run.to.x === 42 && run.to.y === 18, 'free landing unchanged');
    console.log(`  sticky pass now ${fromPt!.x},${fromPt!.y} → ${toPt!.x},${toPt!.y}`);
    writeSample('06-lines-after-player-move.json', diagram, {
      boardId,
      note: 'After moving #8 and #10 — linked pass follows players',
    });

    step(4, 'Erase individual free line');
    const freeIdx = findArrowIndexNearPoint(
      diagram.arrows,
      diagram.players,
      37.5,
      32.5,
      8
    );
    assert(freeIdx >= 0, 'should find free line near segment');
    assert(diagram.arrows[freeIdx].type === 'transition', 'expected free line hit');
    diagram = {
      ...diagram,
      arrows: eraseArrowAtIndex(diagram.arrows, freeIdx),
    };
    saved = await patchBoard(boardId, owner.id, {
      diagram,
      title: 'Lines — sticky pass demo',
      shareMode: BoardShareMode.PRIVATE,
    });
    diagram = saved.diagram as unknown as WebDiagramV1;
    assert(diagram.arrows.length === 3, 'one line erased');
    assert(!diagram.arrows.some((a) => a.type === 'transition'), 'free line gone');
    assert(diagram.arrows.some((a) => a.type === 'pass'), 'pass kept');

    step(5, 'Schema + reload');
    const parsed = parseWebDiagramV1(diagram);
    assert(parsed.ok, 'schema invalid');
    const reloaded = await getBoardForUser(boardId, owner.id);
    assert((reloaded.diagram as any).arrows.length === 3, 'reload lost lines');
    writeSample('07-lines-after-erase.json', reloaded.diagram, {
      boardId,
      title: reloaded.title,
      note: 'After erasing free line; linked pass + run + press remain',
    });

    console.log('\n════════════════════════════════════════');
    console.log(' LINES SCENARIO PASSED');
    console.log(` board was: ${boardId}`);
    console.log(` samples: ${samplesDir()}`);
    console.log('════════════════════════════════════════\n');
  } finally {
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
    console.error('\nLINES SCENARIO FAILED', e);
    await prisma.$disconnect();
    process.exit(1);
  });
