/**
 * Drawing + objects scenario — simulates coach toolbar actions:
 * create → move players → place/move ball → pass/run/press/free lines →
 * shapes → labels → erase one arrow → save → reload.
 *
 * Writes sample diagrams under apps/api/samples/tactical-boards/
 *
 * From apps/api:
 *   TACTICAL_BOARD_V1=1 pnpm run scenario:board-drawing
 */
import * as fs from 'fs';
import * as path from 'path';
import { BoardShareMode, GameModelId, UserRole } from '@prisma/client';
import { prisma } from '../prisma';
import { hashPassword } from '../services/auth';
import { parseWebDiagramV1 } from '../services/board-diagram-schema';
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
  const payload = {
    savedAt: new Date().toISOString(),
    ...meta,
    diagram,
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`  wrote sample ${file}`);
  return file;
}

async function main() {
  process.env.TACTICAL_BOARD_V1 = '1';
  const stamp = `draw-${Date.now()}`;
  const password = 'DrawingTest123!';
  const written: string[] = [];

  step(0, 'Setup coach + club');
  const club = await prisma.club.create({
    data: {
      name: `Drawing Club ${stamp}`,
      code: `DR${Date.now().toString(36).slice(-4).toUpperCase()}`,
      gameModelId: GameModelId.POSSESSION,
      active: true,
    },
  });
  const owner = await prisma.user.create({
    data: {
      email: `${stamp}@example.com`,
      name: 'Drawing Coach',
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
    step(1, 'Create board with default 11v11 lineup + ball');
    const blank = await createBlankBoard(owner.id, {
      title: 'Drawing sample — combo',
      ageGroup: 'U14',
    });
    boardId = blank.id;
    assert((blank.diagram as any).players.length === 22, 'blank should start with default formations');
    let savedSeed = await patchBoard(boardId, owner.id, {
      diagram: DEFAULT_MATCH_BOARD_DIAGRAM,
    });
    let diagram = savedSeed.diagram as unknown as WebDiagramV1;
    assert(diagram.players.length === 22, 'expected 22 starters');
    assert((diagram.balls || []).length >= 1, 'expected centre ball');
    assert(diagram.pitch.format === '11V11' || diagram.pitch.format === undefined, 'format');
    written.push(
      writeSample('01-default-match.json', diagram, {
        title: blank.title,
        boardId,
        note: 'Board after seeding DEFAULT_MATCH_BOARD_DIAGRAM',
      })
    );

    step(2, 'Move ATT #9 + DEF #4 (drag objects)');
    diagram = {
      ...diagram,
      players: diagram.players.map((p) => {
        if (p.team === 'ATT' && p.number === 9) return { ...p, x: 48, y: 38 };
        if (p.team === 'DEF' && p.number === 4) return { ...p, x: 55, y: 28 };
        return p;
      }),
    };
    let saved = await patchBoard(boardId, owner.id, { diagram });
    diagram = saved.diagram as unknown as WebDiagramV1;
    const moved9 = diagram.players.find((p) => p.team === 'ATT' && p.number === 9);
    assert(moved9?.y === 38, `ATT #9 move failed y=${moved9?.y}`);
    console.log(`  ATT #9 → (${moved9?.x}, ${moved9?.y})`);

    step(3, 'Move ball + add second ball');
    diagram = {
      ...diagram,
      balls: [
        { x: 52, y: 42 },
        { x: 40, y: 55 },
      ],
    };
    saved = await patchBoard(boardId, owner.id, { diagram });
    diagram = saved.diagram as unknown as WebDiagramV1;
    assert((diagram.balls || []).length === 2, 'expected 2 balls');
    written.push(
      writeSample('02-moved-players-and-balls.json', diagram, {
        title: saved.title,
        boardId,
        note: 'After dragging striker/CB and placing balls',
      })
    );

    step(4, 'Draw pass / run / press / free lines');
    const attCm = diagram.players.find((p) => p.team === 'ATT' && p.number === 8);
    const att10 = diagram.players.find((p) => p.team === 'ATT' && p.number === 10);
    const att9 = diagram.players.find((p) => p.team === 'ATT' && p.number === 9);
    const def6 = diagram.players.find((p) => p.team === 'DEF' && p.number === 6);
    assert(attCm && att10 && att9 && def6, 'missing formation players for arrows');

    diagram = {
      ...diagram,
      arrows: [
        {
          from: { playerId: attCm!.id },
          to: { playerId: att10!.id },
          type: 'pass',
          style: 'solid',
          weight: 'normal',
        },
        {
          from: { playerId: att10!.id },
          to: { playerId: att9!.id },
          type: 'pass',
          style: 'solid',
          weight: 'normal',
        },
        {
          from: { playerId: att9!.id },
          to: { x: 45, y: 22 },
          type: 'run',
          style: 'dashed',
          weight: 'normal',
        },
        {
          from: { playerId: def6!.id },
          to: { playerId: attCm!.id },
          type: 'press',
          style: 'solid',
          weight: 'bold',
        },
        {
          from: { x: 30, y: 30 },
          to: { x: 60, y: 40 },
          type: 'transition',
          style: 'solid',
          weight: 'normal',
        },
      ],
    };
    saved = await patchBoard(boardId, owner.id, { diagram });
    diagram = saved.diagram as unknown as WebDiagramV1;
    assert(diagram.arrows.length === 5, `expected 5 arrows got ${diagram.arrows.length}`);
    const passCount = diagram.arrows.filter((a) => a.type === 'pass').length;
    assert(passCount === 2, 'expected 2 pass lines');
    console.log(
      '  arrows=',
      diagram.arrows.map((a) => a.type).join(', ')
    );

    step(5, 'Draw box + circle shapes + labels');
    diagram = {
      ...diagram,
      areas: [
        { shape: 'rect', x: 35, y: 25, width: 22, height: 18, label: 'Press zone' },
        { shape: 'circle', x: 42, y: 48, width: 14, height: 14, label: 'Pocket' },
      ],
      labels: [
        { text: 'Third-man run', x: 48, y: 20 },
        { text: 'Pass & move', x: 58, y: 50 },
      ],
    };
    saved = await patchBoard(boardId, owner.id, { diagram });
    diagram = saved.diagram as unknown as WebDiagramV1;
    assert((diagram.areas || []).length === 2, 'expected 2 areas');
    assert(diagram.labels.length === 2, 'expected 2 labels');
    written.push(
      writeSample('03-pass-lines-shapes-labels.json', diagram, {
        title: saved.title,
        boardId,
        note: 'Pass/run/press/free lines + zones + labels',
      })
    );

    step(6, 'Add an extra ATT player, then erase one free line');
    const extra: WebDiagramV1['players'][number] = {
      id: 'att-extra',
      number: 14,
      team: 'ATT',
      role: 'CM',
      x: 60,
      y: 58,
    };
    diagram = {
      ...diagram,
      players: [...diagram.players, extra],
      arrows: diagram.arrows.filter((a) => a.type !== 'transition'),
    };
    saved = await patchBoard(boardId, owner.id, {
      diagram,
      title: 'U14 combo — pass & press',
      shareMode: BoardShareMode.CLUB,
      ageGroup: 'U14',
    });
    diagram = saved.diagram as unknown as WebDiagramV1;
    assert(diagram.players.some((p) => p.id === 'att-extra'), 'extra player missing');
    assert(diagram.arrows.length === 4, 'free line should be erased');
    assert(saved.shareMode === BoardShareMode.CLUB, 'shareMode CLUB');

    step(7, 'Schema validate + reload');
    const parsed = parseWebDiagramV1(diagram);
    assert(parsed.ok, `schema invalid: ${!parsed.ok ? parsed.error : ''}`);
    const reloaded = await getBoardForUser(boardId, owner.id);
    assert(reloaded.canEdit, 'owner canEdit');
    assert((reloaded.diagram as any).arrows.length === 4, 'reload lost arrows');
    assert((reloaded.diagram as any).players.length === 23, 'reload lost players');
    assert((reloaded.diagram as any).balls.length === 2, 'reload lost balls');
    assert((reloaded.diagram as any).areas.length === 2, 'reload lost areas');
    assert(reloaded.title === 'U14 combo — pass & press', 'title lost');

    written.push(
      writeSample('04-final-combo.json', reloaded.diagram, {
        title: reloaded.title,
        boardId,
        shareMode: reloaded.shareMode,
        ageGroup: reloaded.ageGroup,
        note: 'Final saved board after erase + add player + reload',
      })
    );

    // Keep a small README next to samples
    const readme = path.join(samplesDir(), 'README.md');
    fs.writeFileSync(
      readme,
      [
        '# Tactical board drawing samples',
        '',
        'Generated by `pnpm run scenario:board-drawing`.',
        '',
        '| File | Contents |',
        '| --- | --- |',
        '| `01-default-match.json` | Fresh 11v11 board + centre ball |',
        '| `02-moved-players-and-balls.json` | Dragged players + 2 balls |',
        '| `03-pass-lines-shapes-labels.json` | Pass/run/press/free lines, box, circle, labels |',
        '| `04-final-combo.json` | After erase free line, add player, share CLUB |',
        '',
      ].join('\n'),
      'utf8'
    );
    written.push(readme);

    console.log('\n════════════════════════════════════════');
    console.log(' DRAWING SCENARIO PASSED');
    console.log(` board: ${boardId}`);
    console.log(` samples: ${samplesDir()}`);
    console.log(` login: ${owner.email} / ${password}`);
    console.log(` open:  http://localhost:3000/board/${boardId}`);
    console.log('════════════════════════════════════════\n');
  } finally {
    console.log('[cleanup] removing temp club/user (samples kept on disk)');
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
    console.error('\nDRAWING SCENARIO FAILED', e);
    await prisma.$disconnect();
    process.exit(1);
  });
