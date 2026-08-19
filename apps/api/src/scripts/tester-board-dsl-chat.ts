/**
 * Live 20-run: Gemini symbolic DSL → solveBoardLayout.
 *
 *   cd apps/api && pnpm run tester:board-dsl-chat
 *
 * Requires GEMINI_API_KEY and BOARD_AI_SYMBOLIC_DSL=1 (this script forces the flag).
 */
import * as fs from 'fs';
import * as path from 'path';
import '../config/load-env';
import { runBoardAiChat, type BoardAiChatMessage } from '../services/board-ai-chat';
import {
  overlappingPairs,
  solveBoardLayout,
} from '../services/board-layout-solver';
import { parseBoardSymbolicDsl } from '../services/board-symbolic-dsl';
import { DEFAULT_MATCH_BOARD_DIAGRAM, type WebDiagramV1 } from '../services/web-diagram-v1';

process.env.BOARD_AI_SYMBOLIC_DSL = '1';

type Expect = {
  applied?: boolean;
  maxPlayers?: number;
  minPlayers?: number;
  minMiniGoals?: number;
  noOverlap?: boolean;
  attGkRight?: boolean;
  clusterLeft?: boolean;
  clusterRight?: boolean;
  freezeDrift?: number;
  keepRoster?: boolean;
  minArrows?: number;
};

type Spec = {
  name: string;
  claim: string;
  message: string;
  followUp?: string;
  expect: Expect;
};

function cloneDiagram(d: WebDiagramV1): WebDiagramV1 {
  return JSON.parse(JSON.stringify(d)) as WebDiagramV1;
}

function samplesDir() {
  return path.resolve(__dirname, '../../samples/tactical-boards');
}

function writeSample(name: string, data: unknown) {
  const dir = samplesDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), JSON.stringify(data, null, 2));
}

function findGk(d: WebDiagramV1, team: 'ATT' | 'DEF') {
  return (
    d.players.find((p) => p.team === team && (p.role === 'GK' || p.number === 1)) ||
    d.players.find((p) => p.team === team && /gk/i.test(p.role || ''))
  );
}

function miniGoalCount(d: WebDiagramV1) {
  return (d.elements || []).filter((e) => e.kind === 'mini-goal').length;
}

function maxDrift(before: WebDiagramV1, after: WebDiagramV1) {
  return before.players.reduce((m, p) => {
    const q = after.players.find((x) => x.id === p.id);
    if (!q) return m;
    return Math.max(m, Math.hypot(q.x - p.x, q.y - p.y));
  }, 0);
}

function outfield(d: WebDiagramV1) {
  return (d.players || []).filter((p) => p.number !== 1 && !/gk/i.test(p.role || ''));
}

function thirdCounts(d: WebDiagramV1) {
  const ps = outfield(d);
  return {
    left: ps.filter((p) => p.y < 33).length,
    mid: ps.filter((p) => p.y >= 33 && p.y < 67).length,
    right: ps.filter((p) => p.y >= 67).length,
  };
}

function formationSeed(): WebDiagramV1 {
  const parsed = parseBoardSymbolicDsl({
    activity: 'match_scenario',
    seed: 'formation',
    grid: { intent: 'full_pitch', format: '11V11', attFormation: '4-3-3', defFormation: '4-2-3-1' },
    entities: [],
    equipment: [],
    actions: [],
    moves: [],
  });
  if (!parsed.ok) throw new Error(parsed.error);
  return solveBoardLayout(parsed.dsl);
}

function check(start: WebDiagramV1, after: WebDiagramV1, applied: boolean, exp: Expect): string[] {
  const fails: string[] = [];
  if (exp.applied !== undefined && applied !== exp.applied) {
    fails.push(`applied=${applied} want ${exp.applied}`);
  }
  if (!applied && exp.applied === false) return fails;
  if (!applied) return fails;
  const n = after.players?.length || 0;
  if (exp.maxPlayers !== undefined && n > exp.maxPlayers) fails.push(`players=${n} > ${exp.maxPlayers}`);
  if (exp.minPlayers !== undefined && n < exp.minPlayers) fails.push(`players=${n} < ${exp.minPlayers}`);
  if (exp.minMiniGoals !== undefined && miniGoalCount(after) < exp.minMiniGoals) {
    fails.push(`mini-goals=${miniGoalCount(after)} < ${exp.minMiniGoals}`);
  }
  if (exp.noOverlap) {
    const pairs = overlappingPairs(after.players || []);
    if (pairs.length) {
      fails.push(`overlaps=${pairs.length} ${pairs.slice(0, 3).map((p) => `${p.a}/${p.b}`).join(',')}`);
    }
  }
  if (exp.attGkRight) {
    const att = findGk(after, 'ATT');
    const def = findGk(after, 'DEF');
    if (att && att.y < 70) fails.push(`ATT GK y=${att.y.toFixed(1)} (want RIGHT / high y)`);
    if (def && def.y > 30) fails.push(`DEF GK y=${def.y.toFixed(1)} (want LEFT / low y)`);
    if (att && def && att.y <= def.y) fails.push('ATT GK not to the right of DEF GK');
  }
  const thirds = thirdCounts(after);
  if (exp.clusterLeft && !(thirds.left > thirds.right && thirds.left >= 3)) {
    fails.push(`thirds L/M/R=${thirds.left}/${thirds.mid}/${thirds.right} (want LEFT)`);
  }
  if (exp.clusterRight && !(thirds.right > thirds.left && thirds.right >= 3)) {
    fails.push(`thirds L/M/R=${thirds.left}/${thirds.mid}/${thirds.right} (want RIGHT)`);
  }
  if (exp.freezeDrift !== undefined) {
    const drift = maxDrift(start, after);
    if (drift > exp.freezeDrift) fails.push(`freeze drift=${drift.toFixed(2)} > ${exp.freezeDrift}`);
  }
  if (exp.keepRoster && after.players.length !== start.players.length) {
    fails.push(`roster ${start.players.length}→${after.players.length}`);
  }
  if (exp.minArrows !== undefined) {
    const nArr = after.arrows?.length || 0;
    if (nArr < exp.minArrows) fails.push(`arrows=${nArr} < ${exp.minArrows}`);
  }
  return fails;
}

const SPECS: Spec[] = [
  {
    name: 'rondo-4v4',
    claim: 'Rondo stays a rondo; mini-goals are kit',
    message: '4v4 rondo in the middle third, mini-goals on the ends. Just draw it.',
    expect: { applied: true, maxPlayers: 12, minMiniGoals: 1, noOverlap: true },
  },
  {
    name: 'play-out-433',
    claim: '11v11 play-out, us own goal RIGHT',
    message: '11v11 4-3-3 vs 4-2-3-1, us playing out from the right. Just draw it.',
    expect: { applied: true, minPlayers: 20, noOverlap: true, attGkRight: true },
  },
  {
    name: 'back3-mini-goal',
    claim: 'Back 3 + mini-goal in our defensive third',
    message: 'Back 3 protecting a mini-goal, our defensive third. Just draw it.',
    expect: { applied: true, maxPlayers: 12, minMiniGoals: 1, noOverlap: true, clusterRight: true },
  },
  {
    name: 'just-draw-press',
    claim: '“Just draw it” applies a press after loss',
    message: 'Press after we lose it. Just draw it.',
    expect: { applied: true, noOverlap: true },
  },
  {
    name: 'high-press-left',
    claim: 'High press lives in their defensive third (LEFT)',
    message: '11v11 4-3-3 vs 4-2-3-1 high press in their defensive third. Just draw it.',
    expect: { applied: true, minPlayers: 20, noOverlap: true, attGkRight: true, clusterLeft: true },
  },
  {
    name: 'defend-our-third',
    claim: 'Defending our third sits RIGHT',
    message: '11v11 4-4-2 vs 4-3-3 defending in our defensive third. Just draw it.',
    expect: { applied: true, minPlayers: 20, noOverlap: true, attGkRight: true, clusterRight: true },
  },
  {
    name: '7v7-build',
    claim: '7v7 does not upsample to 22 shirts',
    message: '7v7 2-3-1 vs 3-2-1, ATT build-up. Just draw it.',
    expect: { applied: true, maxPlayers: 16, minPlayers: 10, noOverlap: true },
  },
  {
    name: '9v9-transition',
    claim: '9v9 attacking transition stays 9v9',
    message: '9v9 3-2-3 vs 2-3-2-1, central channel, attacking transition. Just draw it.',
    expect: { applied: true, maxPlayers: 20, minPlayers: 14, noOverlap: true },
  },
  {
    name: '442-press-playout',
    claim: '4-4-2 press on our play-out, no stack',
    message: '11v11 ATT 4-3-3 vs DEF 4-4-2 high press on our play-out. Just draw it.',
    expect: { applied: true, minPlayers: 20, noOverlap: true, attGkRight: true },
  },
  {
    name: 'switch-3-to-7',
    claim: 'Switch of play attaches arrows to shirts',
    message: '11v11 4-3-3 vs 4-2-3-1, switch of play from ATT 3 to ATT 7. Just draw it.',
    expect: { applied: true, minPlayers: 20, noOverlap: true, minArrows: 1 },
  },
  {
    name: 'freeze-pass',
    claim: 'Freeze keeps shirts; pass 6→10 still draws',
    message: "Don't move the players. Draw a pass from ATT 6 to ATT 10. Just draw it.",
    expect: { applied: true, freezeDrift: 1.5, keepRoster: true, minArrows: 1, noOverlap: true },
  },
  {
    name: 'from-board-press',
    claim: 'From this board: DEF 9 presses ATT 6; roster stays',
    message: 'From this board, have DEF 9 press ATT 6. Just draw it.',
    expect: { applied: true, keepRoster: true, noOverlap: true, minArrows: 1 },
  },
  {
    name: 'ssg-6v6',
    claim: 'SSG stays a grid, not 11v11',
    message: '6v6 SSG in a boxed midfield grid with two mini-goals. Just draw it.',
    expect: { applied: true, maxPlayers: 16, minMiniGoals: 1, noOverlap: true },
  },
  {
    name: 'rondo-5v2',
    claim: '5v2 rondo is not 22 shirts',
    message: '5v2 rondo, cones marking the square. Just draw it.',
    expect: { applied: true, maxPlayers: 10, noOverlap: true },
  },
  {
    name: 'combo-right',
    claim: 'Right-side combination, both teams, no overlap',
    message: '11v11 4-3-3 vs 4-2-3-1, combination play on the right side. Just draw it.',
    expect: { applied: true, minPlayers: 20, noOverlap: true, attGkRight: true },
  },
  {
    name: 'numbered-then-draw',
    claim: 'Vague press → then just draw it still applies',
    message: 'Show me a press after we lose it.',
    followUp: 'just draw it',
    expect: { applied: true, noOverlap: true },
  },
  {
    name: 'counterpress-left',
    claim: 'Counterpress after loss in their third (LEFT)',
    message:
      '11v11 4-3-3 vs 4-2-3-1, counterpress in their defensive third after we lose it. Just draw it.',
    expect: { applied: true, minPlayers: 20, noOverlap: true, clusterLeft: true },
  },
  {
    name: 'goal-kick-seq',
    claim: 'Goal-kick play-out applies without stacking',
    message: 'Goal kick play-out, 4-3-3 vs 4-4-2 press. Sequence the play. Just draw it.',
    expect: { applied: true, minPlayers: 20, noOverlap: true, attGkRight: true },
  },
  {
    name: 'technical-diamond',
    claim: 'Technical diamond stays a function, not 11v11',
    message: 'Technical passing diamond, 4 players plus 2 mini-goals. Just draw it.',
    expect: { applied: true, maxPlayers: 10, minMiniGoals: 1, noOverlap: true },
  },
  {
    name: 'mid-block',
    claim: 'Mid-block in the middle third, 22 shirts, no stack',
    message: '11v11 4-2-3-1 vs 4-4-2 mid-block in the middle third. Just draw it.',
    expect: { applied: true, minPlayers: 20, noOverlap: true, attGkRight: true },
  },
];

async function runOne(
  spec: Spec,
  start: WebDiagramV1
): Promise<{
  name: string;
  claim: string;
  ok: boolean;
  lines: string[];
  ms: number;
}> {
  const t0 = Date.now();
  const lines: string[] = [];
  try {
    const first = await runBoardAiChat({
      diagram: cloneDiagram(start),
      message: spec.message,
      history: [],
      ageGroup: 'U13',
      gameModelId: 'POSSESSION',
      coachLevel: 'USSF_C',
    });
    let applied = first.applied;
    let after = first.diagram;
    let reply = first.reply || '';
    const history: BoardAiChatMessage[] = [
      { role: 'user', content: spec.message },
      { role: 'assistant', content: first.reply },
    ];
    if (spec.followUp && !applied) {
      const second = await runBoardAiChat({
        diagram: cloneDiagram(after),
        message: spec.followUp,
        history,
        ageGroup: 'U13',
        gameModelId: 'POSSESSION',
        coachLevel: 'USSF_C',
      });
      applied = second.applied;
      after = second.diagram;
      reply = second.reply || reply;
      lines.push('follow-up used (first turn did not apply)');
    }
    const fails = check(start, after, applied, spec.expect);
    const n = after.players?.length || 0;
    const ov = overlappingPairs(after.players || []).length;
    lines.push(
      `applied=${applied} players=${n} overlaps=${ov} mini-goals=${miniGoalCount(after)} arrows=${after.arrows?.length || 0}`
    );
    const att = findGk(after, 'ATT');
    const def = findGk(after, 'DEF');
    const thirds = thirdCounts(after);
    if (att || def || after.players?.length) {
      lines.push(
        `ATT GK ${att ? att.y.toFixed(1) : '—'}  DEF GK ${def ? def.y.toFixed(1) : '—'}  thirds L/M/R=${thirds.left}/${thirds.mid}/${thirds.right}`
      );
    }
    if (!applied) {
      const note = reply.split('\n').slice(-2).join(' ').slice(0, 180);
      lines.push(`reply-tail: ${note}`);
    }
    if (fails.length) lines.push(`FAIL ${fails.join('; ')}`);
    writeSample(`dsl-chat-${spec.name}.json`, {
      name: spec.name,
      applied,
      reply: reply.slice(0, 1200),
      players: n,
      overlaps: ov,
      elements: after.elements || [],
      arrows: after.arrows || [],
    });
    return { name: spec.name, claim: spec.claim, ok: fails.length === 0, lines, ms: Date.now() - t0 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    lines.push(`error: ${msg.slice(0, 240)}`);
    return { name: spec.name, claim: spec.claim, ok: false, lines, ms: Date.now() - t0 };
  }
}

async function pool<T, R>(items: T[], n: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, () => worker()));
  return out;
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY missing');
    process.exit(1);
  }
  console.log('\nDSL chat 20-run  BOARD_AI_SYMBOLIC_DSL=1  concurrency=2\n');
  const start = formationSeed();
  const results = await pool(SPECS, 2, (spec) => runOne(spec, start));
  console.log(`${'RESULT'.padEnd(6)}  ${'CASE'.padEnd(22)}  ${'ms'.padStart(6)}  CLAIM`);
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL '}  ${r.name.padEnd(22)}  ${String(r.ms).padStart(6)}  ${r.claim}`);
    for (const line of r.lines) console.log(`        ${line}`);
  }
  const failed = results.filter((r) => !r.ok);
  const summary = {
    flag: process.env.BOARD_AI_SYMBOLIC_DSL,
    passed: results.length - failed.length,
    total: results.length,
    failed: failed.map((f) => f.name),
    cases: results.map((r) => ({ name: r.name, ok: r.ok, ms: r.ms, lines: r.lines })),
  };
  writeSample('dsl-chat-20-run.json', summary);
  console.log(`\n${summary.passed}/${summary.total} passed`);
  console.log(`JSON dumps: ${samplesDir()}`);
  if (failed.length) {
    console.error(`Failed: ${failed.map((f) => f.name).join(', ')}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
