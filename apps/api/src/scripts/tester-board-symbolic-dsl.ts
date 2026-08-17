/**
 * Theory proof: symbolic DSL + TS solver vs Gemini x/y.
 * Covers the bugs we actually hit — still no chat wire.
 *
 *   cd apps/api && pnpm run tester:board-dsl
 */
import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_MATCH_BOARD_DIAGRAM, defaultMatchBoardDiagram, type WebDiagramV1 } from '../services/web-diagram-v1';
import { parseBoardSymbolicDsl, lockDslFormat, lockDslSeed, ensureDslEquipmentFromMessage, type BoardSymbolicDsl } from '../services/board-symbolic-dsl';
import {
  gridBox,
  overlappingPairs,
  solveBoardLayout,
  SOLVER_MIN_PLAYER_GAP,
} from '../services/board-layout-solver';

function samplesDir() {
  return path.resolve(__dirname, '../../samples/tactical-boards');
}

function writeSample(name: string, data: unknown) {
  const dir = samplesDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), JSON.stringify(data, null, 2));
}

function findPlayer(d: WebDiagramV1, team: 'ATT' | 'DEF', number: number) {
  return d.players.find((p) => p.team === team && p.number === number);
}

function dist(
  a: { x: number; y: number } | undefined,
  b: { x: number; y: number } | undefined
) {
  if (!a || !b) return NaN;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function fmt(p: { x: number; y: number } | undefined) {
  if (!p) return 'missing';
  return `(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`;
}

function tokensOf(obj: unknown) {
  return Math.round(JSON.stringify(obj).length / 4);
}

function mustParse(dsl: BoardSymbolicDsl, name: string): BoardSymbolicDsl {
  const parsed = parseBoardSymbolicDsl(dsl);
  if (!parsed.ok) throw new Error(`${name}: ${parsed.error}`);
  return parsed.dsl;
}

type CaseResult = { name: string; claim: string; ok: boolean; lines: string[] };

function caseOverlap(): CaseResult {
  const lines: string[] = [];
  const now = DEFAULT_MATCH_BOARD_DIAGRAM;
  const dsl = mustParse(
    {
      activity: 'match_scenario',
      seed: 'formation',
      grid: { intent: 'full_pitch', format: '11V11', attFormation: '4-3-3', defFormation: '4-2-3-1' },
      entities: [],
      equipment: [],
      actions: [
        { type: 'pass', from_id: 'att-6', to_id: 'att-10' },
        { type: 'press', from_id: 'def-9', to_id: 'att-6' },
      ],
      moves: [],
    },
    'overlap'
  );
  const after = solveBoardLayout(dsl);
  const dNow = dist(findPlayer(now, 'ATT', 6), findPlayer(now, 'DEF', 9));
  const dAfter = dist(findPlayer(after, 'ATT', 6), findPlayer(after, 'DEF', 9));
  const nowN = overlappingPairs(now.players).length;
  const afterN = overlappingPairs(after.players).length;
  lines.push(`NOW ATT6–DEF9 dist=${dNow.toFixed(2)} overlaps=${nowN}  AFTER dist=${dAfter.toFixed(2)} overlaps=${afterN}`);
  lines.push(`payload shirts ~${tokensOf(now.players)} tok  dsl ~${tokensOf(dsl)} tok`);
  writeSample('dsl-tester-11v11-now.json', now);
  writeSample('dsl-tester-11v11-after.json', after);
  return {
    name: 'overlap',
    claim: 'Shirts never share space (red 9 / blue 6)',
    ok: dNow < SOLVER_MIN_PLAYER_GAP && dAfter >= SOLVER_MIN_PLAYER_GAP && afterN === 0,
    lines,
  };
}

function caseHallucination(): CaseResult {
  const lines: string[] = [];
  const now: WebDiagramV1 = {
    ...DEFAULT_MATCH_BOARD_DIAGRAM,
    players: DEFAULT_MATCH_BOARD_DIAGRAM.players.map((p) =>
      (p.team === 'ATT' && p.number === 6) || (p.team === 'DEF' && p.number === 9)
        ? { ...p, x: 50, y: 50 }
        : p
    ),
  };
  const after = solveBoardLayout(
    mustParse(
      {
        activity: 'match_scenario',
        seed: 'formation',
        grid: { intent: 'full_pitch', format: '11V11', attFormation: '4-3-3', defFormation: '4-2-3-1' },
        entities: [],
        equipment: [],
        actions: [{ type: 'press', from_id: 'def-9', to_id: 'att-6' }],
        moves: [],
      },
      'hallucination'
    )
  );
  const dNow = dist(findPlayer(now, 'ATT', 6), findPlayer(now, 'DEF', 9));
  const dAfter = dist(findPlayer(after, 'ATT', 6), findPlayer(after, 'DEF', 9));
  lines.push(`Gemini dump dist=${dNow.toFixed(2)}  solver dist=${dAfter.toFixed(2)}`);
  return {
    name: 'hallucination',
    claim: 'Model cannot invent a pile-up at (50,50)',
    ok: dNow < 0.1 && dAfter >= SOLVER_MIN_PLAYER_GAP,
    lines,
  };
}

function caseRondoNoUpsample(): CaseResult {
  const lines: string[] = [];
  const dsl = mustParse(
    {
      activity: 'rondo',
      seed: 'blank',
      grid: {
        intent: 'rondo',
        format: '11V11',
        attFormation: '4-3-3',
        defFormation: '4-2-3-1',
      },
      entities: [
        { id: 'att-4', team: 'ATT', number: 4, relative_position: 'perimeter' },
        { id: 'att-5', team: 'ATT', number: 5, relative_position: 'perimeter' },
        { id: 'att-6', team: 'ATT', number: 6, relative_position: 'perimeter' },
        { id: 'att-8', team: 'ATT', number: 8, relative_position: 'perimeter' },
        { id: 'def-9', team: 'DEF', number: 9, relative_position: 'inside' },
      ],
      equipment: [
        { kind: 'mini-goal', placement: 'grid_w', quantity: 1 },
        { kind: 'mini-goal', placement: 'grid_e', quantity: 1 },
      ],
      actions: [{ type: 'pass', from_id: 'att-4', to_id: 'att-6' }],
      moves: [],
    },
    'rondo'
  );
  const after = solveBoardLayout(dsl);
  const kit = (after.elements || []).filter((e) => e.kind === 'mini-goal').length;
  const fakePlayers = after.players.filter((p) => /goal|cone|mini/i.test(p.role || ''));
  lines.push(`players=${after.players.length} (not 22)  mini-goals=${kit}  overlaps=${overlappingPairs(after.players).length}`);
  writeSample('dsl-tester-rondo-after.json', after);
  writeSample('dsl-tester-rondo-dsl.json', dsl);
  return {
    name: 'rondo-no-upsample',
    claim: 'Rondo stays a rondo; mini-goals are kit not shirts',
    ok:
      after.players.length === 5 &&
      kit === 2 &&
      fakePlayers.length === 0 &&
      overlappingPairs(after.players).length === 0,
    lines,
  };
}

function caseImportOrientation(): CaseResult {
  const lines: string[] = [];
  const now: WebDiagramV1 = {
    pitch: { variant: 'FULL', orientation: 'HORIZONTAL', format: '11V11' },
    players: [
      { id: 'att-1', team: 'ATT', number: 1, role: 'GK', x: 5, y: 50 },
      { id: 'att-4', team: 'ATT', number: 4, x: 18, y: 30 },
      { id: 'att-5', team: 'ATT', number: 5, x: 18, y: 50 },
      { id: 'att-3', team: 'ATT', number: 3, x: 18, y: 70 },
    ],
    arrows: [],
    areas: [],
    labels: [],
    balls: [],
  };
  const dsl = mustParse(
    {
      activity: 'technical_exercise',
      seed: 'blank',
      grid: { intent: 'third_right', format: '11V11' },
      entities: [
        { id: 'att-1', team: 'ATT', number: 1, role: 'GK', relative_position: 'own_gk' },
        { id: 'att-4', team: 'ATT', number: 4, role: 'CB', relative_position: 'own_line' },
        { id: 'att-5', team: 'ATT', number: 5, role: 'CB', relative_position: 'own_line' },
        { id: 'att-3', team: 'ATT', number: 3, role: 'CB', relative_position: 'own_line' },
      ],
      equipment: [{ kind: 'mini-goal', placement: 'grid_e', quantity: 1 }],
      actions: [],
      moves: [],
    },
    'import'
  );
  const after = solveBoardLayout(dsl);
  const gk = findPlayer(after, 'ATT', 1);
  const backs = after.players.filter((p) => p.number !== 1);
  const ys = backs.map((p) => p.y);
  const ySpread = Math.max(...ys) - Math.min(...ys);
  const xSpread = Math.max(...backs.map((p) => p.x)) - Math.min(...backs.map((p) => p.x));
  const touchline = !!gk && Math.min(gk.x, 100 - gk.x) < 20;
  const goalEnd = !!gk && gk.y >= 85 && Math.abs(gk.x - 50) < 20;
  lines.push(`NOW GK ${fmt(findPlayer(now, 'ATT', 1))} (on top touchline)`);
  lines.push(`AFTER GK ${fmt(gk)}  back3 ySpread=${ySpread.toFixed(1)} xSpread=${xSpread.toFixed(1)}  kit=${after.elements?.length || 0}`);
  writeSample('dsl-tester-import-now.json', now);
  writeSample('dsl-tester-import-after.json', after);
  return {
    name: 'import-orientation',
    claim: 'PDF portrait ≠ GK on touchline; back 3 parallel to goal',
    ok: !touchline && goalEnd && xSpread > ySpread && xSpread >= 16 && (after.elements?.length || 0) === 1,
    lines,
  };
}

function caseTheirThird(): CaseResult {
  const lines: string[] = [];
  const dsl = mustParse(
    {
      activity: 'match_scenario',
      seed: 'formation',
      grid: { intent: 'third_left', format: '11V11', attFormation: '4-3-3', defFormation: '4-2-3-1' },
      entities: [],
      equipment: [],
      actions: [{ type: 'press', from_id: 'att-9', to_id: 'def-4' }],
      moves: [],
    },
    'third'
  );
  const after = solveBoardLayout(dsl);
  const att = after.players.filter((p) => p.team === 'ATT');
  const meanY = att.reduce((s, p) => s + p.y, 0) / Math.max(1, att.length);
  lines.push(`ATT mean y=${meanY.toFixed(1)} (their defensive third must be LEFT, y<33)`);
  return {
    name: 'their-third',
    claim: '“Their defensive third” is y 0–33, not midfield',
    ok: meanY < 40 && after.areas.length === 0,
    lines,
  };
}

function caseSeedCurrent(): CaseResult {
  const lines: string[] = [];
  const current = DEFAULT_MATCH_BOARD_DIAGRAM;
  const rb = findPlayer(current, 'ATT', 2);
  const dsl = mustParse(
    {
      activity: 'match_scenario',
      seed: 'current',
      grid: { intent: 'full_pitch', format: '11V11', attFormation: '4-4-2' },
      entities: [],
      equipment: [],
      actions: [{ type: 'press', from_id: 'def-9', to_id: 'att-6' }],
      moves: [{ id: 'def-9', to: 'press:att-6' }],
    },
    'current'
  );
  const after = solveBoardLayout(dsl, current);
  const rbAfter = findPlayer(after, 'ATT', 2);
  const rbDrift = dist(rb, rbAfter);
  const dPress = dist(findPlayer(after, 'DEF', 9), findPlayer(after, 'ATT', 6));
  const sameCount = after.players.length === current.players.length;
  lines.push(`roster ${current.players.length}→${after.players.length}  ATT#2 drift=${rbDrift.toFixed(2)}  DEF9–ATT6=${dPress.toFixed(2)}`);
  lines.push(`formation 4-4-2 on the DSL was ignored (seed=current)`);
  writeSample('dsl-tester-current-after.json', after);
  return {
    name: 'seed-current',
    claim: 'Follow-up keeps the live roster; only named moves change',
    ok:
      sameCount &&
      rbDrift < 6 &&
      dPress >= SOLVER_MIN_PLAYER_GAP &&
      overlappingPairs(after.players).length === 0,
    lines,
  };
}

function caseFreeze(): CaseResult {
  const lines: string[] = [];
  const current = solveBoardLayout(
    mustParse(
      {
        activity: 'match_scenario',
        seed: 'formation',
        grid: { intent: 'full_pitch', format: '11V11', attFormation: '4-3-3', defFormation: '4-2-3-1' },
        entities: [],
        equipment: [],
        actions: [],
        moves: [],
      },
      'freeze-seed'
    )
  );
  const dsl = mustParse(
    {
      activity: 'match_scenario',
      seed: 'current',
      grid: { intent: 'full_pitch' },
      entities: [],
      equipment: [],
      actions: [{ type: 'pass', from_id: 'att-6', to_id: 'att-10' }],
      moves: [],
    },
    'freeze'
  );
  const after = solveBoardLayout(dsl, current);
  const maxDrift = current.players.reduce((m, p) => {
    const q = after.players.find((x) => x.id === p.id);
    return Math.max(m, dist(p, q));
  }, 0);
  lines.push(`max shirt drift=${maxDrift.toFixed(2)}  arrows=${after.arrows.length}`);
  return {
    name: 'freeze',
    claim: 'Freeze = current seed, empty moves, arrows only',
    ok: maxDrift < 0.05 && after.arrows.length === 1,
    lines,
  };
}

function caseUsGoalRight(): CaseResult {
  const after = solveBoardLayout(
    mustParse(
      {
        activity: 'match_scenario',
        seed: 'formation',
        grid: { intent: 'full_pitch', format: '11V11', attFormation: '4-3-3', defFormation: '4-2-3-1' },
        entities: [],
        equipment: [],
        actions: [],
        moves: [],
      },
      'us'
    )
  );
  const attGk = findPlayer(after, 'ATT', 1);
  const defGk = findPlayer(after, 'DEF', 1);
  const lines = [`ATT GK ${fmt(attGk)}  DEF GK ${fmt(defGk)}`];
  return {
    name: 'us-goal-right',
    claim: 'Us = ATT, own goal RIGHT (high y); them LEFT',
    ok: !!attGk && attGk.y >= 88 && !!defGk && defGk.y <= 12,
    lines,
  };
}

function caseArrowIds(): CaseResult {
  const after = solveBoardLayout(
    mustParse(
      {
        activity: 'match_scenario',
        seed: 'formation',
        grid: { intent: 'full_pitch', format: '11V11', attFormation: '4-3-3', defFormation: '4-2-3-1' },
        entities: [],
        equipment: [],
        actions: [{ type: 'pass', from_id: 'att-6', to_id: 'att-10' }],
        moves: [],
      },
      'arrows'
    )
  );
  const a = after.arrows[0];
  const from = after.players.find((p) => p.id === a?.from.playerId);
  const to = after.players.find((p) => p.id === a?.to.playerId);
  const lines = [`pass ${from?.team}${from?.number} → ${to?.team}${to?.number}`];
  return {
    name: 'arrow-ids',
    claim: 'Actions attach to shirts by id, not empty grass',
    ok: from?.number === 6 && to?.number === 10,
    lines,
  };
}

function caseGridBox(): CaseResult {
  const left = gridBox('third_left');
  const mid = gridBox('third_middle');
  const right = gridBox('third_right');
  const lines = [
    `left y=${left.y}-${left.y + left.height}  mid y=${mid.y}-${mid.y + mid.height}  right y=${right.y}-${right.y + right.height}`,
  ];
  return {
    name: 'grid-boxes',
    claim: 'Third bands are code, not prompt poetry',
    ok: left.y + left.height <= mid.y + 2 && mid.y + mid.height <= right.y + 2 && right.y >= 65,
    lines,
  };
}

function caseAdmit7v7(): CaseResult {
  const parsed = parseBoardSymbolicDsl({
    activity: 'match_scenario',
    seed: 'formation',
    grid: { intent: 'full_pitch', format: '7V7', attFormation: '2-3-1', defFormation: '3-2-1' },
  });
  if (!parsed.ok) {
    return { name: 'admit-7v7', claim: '7v7 2-3-1 vs 3-2-1 applies', ok: false, lines: [parsed.error] };
  }
  const after = solveBoardLayout(parsed.dsl);
  const n = after.players.length;
  const ov = overlappingPairs(after.players).length;
  return {
    name: 'admit-7v7',
    claim: '7v7 2-3-1 vs 3-2-1 applies',
    ok: n === 14 && ov === 0 && after.pitch.format === '7V7',
    lines: [`players=${n} overlaps=${ov} format=${after.pitch.format}`],
  };
}

function caseAdmitUnknownToken(): CaseResult {
  const parsed = parseBoardSymbolicDsl({
    activity: 'ssg',
    grid: { intent: 'small_sided', attFormation: '231' },
    entities: [{ id: 'att-6', team: 'HOME', number: 6, relative_position: 'center_defending' }],
  });
  if (!parsed.ok) {
    return {
      name: 'admit-alias',
      claim: 'Unknown tokens coerce; x/y still rejected',
      ok: false,
      lines: [parsed.error],
    };
  }
  const coord = parseBoardSymbolicDsl({
    activity: 'rondo',
    grid: { intent: 'rondo' },
    entities: [{ id: 'att-6', team: 'ATT', relative_position: 'inside', x: 50, y: 50 }],
  });
  const lines = [
    `activity=${parsed.dsl.activity} intent=${parsed.dsl.grid.intent} form=${parsed.dsl.grid.attFormation} pos=${parsed.dsl.entities[0]?.relative_position}`,
    `xy stripped=${coord.ok ? 'yes' : coord.error}`,
  ];
  return {
    name: 'admit-alias',
    claim: 'Unknown tokens coerce; x/y on entities are stripped',
    ok:
      parsed.dsl.activity === 'scrimmage' &&
      parsed.dsl.grid.intent === 'ssg_grid' &&
      parsed.dsl.grid.attFormation === '2-3-1' &&
      parsed.dsl.entities[0]?.relative_position === 'inside' &&
      coord.ok === true &&
      coord.dsl.entities[0]?.relative_position === 'inside',
    lines,
  };
}

function caseFunctionNotCurrent(): CaseResult {
  const live = DEFAULT_MATCH_BOARD_DIAGRAM;
  const parsed = parseBoardSymbolicDsl({
    activity: 'technical_exercise',
    grid: { intent: 'third_right' },
    entities: [
      { id: 'att-1', team: 'ATT', number: 1, relative_position: 'own_gk' },
      { id: 'att-4', team: 'ATT', number: 4, relative_position: 'own_line' },
      { id: 'att-5', team: 'ATT', number: 5, relative_position: 'own_line' },
      { id: 'att-3', team: 'ATT', number: 3, relative_position: 'own_line' },
    ],
    equipment: [{ kind: 'mini-goal', placement: 'grid_e', quantity: 1 }],
  });
  if (!parsed.ok) {
    return { name: 'function-blank', claim: 'Back 3 from a 22-shirt board blanks', ok: false, lines: [parsed.error] };
  }
  const locked = lockDslSeed(parsed.dsl, {});
  const after = solveBoardLayout(locked, live);
  const kit = (after.elements || []).filter((e) => e.kind === 'mini-goal').length;
  return {
    name: 'function-blank',
    claim: 'Back 3 from a 22-shirt board blanks',
    ok: locked.seed === 'blank' && after.players.length === 4 && kit === 1,
    lines: [`seed=${locked.seed} players=${after.players.length} mini-goals=${kit}`],
  };
}

function caseRondoTwoInside(): CaseResult {
  const parsed = parseBoardSymbolicDsl({
    activity: 'rondo',
    grid: { intent: 'rondo' },
    entities: [
      { id: 'att-4', team: 'ATT', number: 4, relative_position: 'perimeter' },
      { id: 'att-5', team: 'ATT', number: 5, relative_position: 'perimeter' },
      { id: 'att-6', team: 'ATT', number: 6, relative_position: 'perimeter' },
      { id: 'att-8', team: 'ATT', number: 8, relative_position: 'perimeter' },
      { id: 'att-9', team: 'ATT', number: 9, relative_position: 'inside' },
      { id: 'def-8', team: 'DEF', number: 8, relative_position: 'inside' },
      { id: 'def-9', team: 'DEF', number: 9, relative_position: 'inside' },
    ],
  });
  if (!parsed.ok) {
    return { name: 'rondo-inside', claim: '5v2 inside stack still unstacks to gap 8', ok: false, lines: [parsed.error] };
  }
  const after = solveBoardLayout(parsed.dsl, DEFAULT_MATCH_BOARD_DIAGRAM);
  const ov = overlappingPairs(after.players).length;
  return {
    name: 'rondo-inside',
    claim: '5v2 inside stack still unstacks to gap 8',
    ok: after.players.length === 7 && ov === 0,
    lines: [`players=${after.players.length} overlaps=${ov}`],
  };
}

function caseSeedCurrentTheirThird(): CaseResult {
  const current = DEFAULT_MATCH_BOARD_DIAGRAM;
  const dsl = mustParse(
    {
      activity: 'match_scenario',
      seed: 'current',
      grid: { intent: 'third_left', format: '11V11' },
      entities: [],
      equipment: [],
      actions: [],
      moves: [],
    },
    'current-third'
  );
  const after = solveBoardLayout(dsl, current);
  const out = after.players.filter((p) => p.number !== 1 && !/gk/i.test(p.role || ''));
  const left = out.filter((p) => p.y < 33).length;
  const right = out.filter((p) => p.y >= 67).length;
  const ov = overlappingPairs(after.players).length;
  return {
    name: 'current-third',
    claim: 'From this board + their third pulls the block LEFT',
    ok: after.players.length === current.players.length && left > right && left >= 3 && ov === 0,
    lines: [`roster ${current.players.length}→${after.players.length} L/R=${left}/${right} overlaps=${ov}`],
  };
}

function caseRondoRing(): CaseResult {
  const parsed = parseBoardSymbolicDsl({
    activity: 'rondo',
    grid: { intent: 'rondo' },
    entities: [
      { id: 'att-4', team: 'ATT', number: 4, relative_position: 'inside' },
      { id: 'att-5', team: 'ATT', number: 5, relative_position: 'inside' },
      { id: 'att-6', team: 'ATT', number: 6, relative_position: 'inside' },
      { id: 'att-8', team: 'ATT', number: 8, relative_position: 'inside' },
      { id: 'neu-1', team: 'NEUTRAL', number: 10, relative_position: 'inside' },
      { id: 'neu-2', team: 'NEUTRAL', number: 11, relative_position: 'inside' },
      { id: 'def-6', team: 'DEF', number: 6, relative_position: 'inside' },
      { id: 'def-8', team: 'DEF', number: 8, relative_position: 'inside' },
      { id: 'def-4', team: 'DEF', number: 4, relative_position: 'inside' },
      { id: 'def-5', team: 'DEF', number: 5, relative_position: 'inside' },
    ],
  });
  if (!parsed.ok) {
    return { name: 'rondo-ring', claim: '4v4+2 rondo is a ring, not a stick', ok: false, lines: [parsed.error] };
  }
  const after = solveBoardLayout(parsed.dsl);
  const defs = after.players.filter((p) => p.team === 'DEF');
  const xs = defs.map((p) => p.x);
  const spread = Math.max(...xs) - Math.min(...xs);
  const ov = overlappingPairs(after.players).length;
  return {
    name: 'rondo-ring',
    claim: '4v4+2 rondo is a ring, not a stick',
    ok: after.players.length === 10 && ov === 0 && spread > 8,
    lines: [`players=${after.players.length} def-x-spread=${spread.toFixed(1)} overlaps=${ov}`],
  };
}

function caseRondoKeeps9v9(): CaseResult {
  const current = defaultMatchBoardDiagram('9V9');
  const dsl = lockDslFormat(
    mustParse(
      {
        activity: 'rondo',
        seed: 'blank',
        grid: { intent: 'rondo', format: '7V7', attFormation: '2-3-1' },
        entities: [
          { id: 'att-4', team: 'ATT', number: 4, relative_position: 'perimeter' },
          { id: 'att-5', team: 'ATT', number: 5, relative_position: 'perimeter' },
          { id: 'att-6', team: 'ATT', number: 6, relative_position: 'perimeter' },
          { id: 'att-8', team: 'ATT', number: 8, relative_position: 'perimeter' },
          { id: 'def-6', team: 'DEF', number: 6, relative_position: 'inside' },
          { id: 'def-8', team: 'DEF', number: 8, relative_position: 'inside' },
          { id: 'def-4', team: 'DEF', number: 4, relative_position: 'inside' },
          { id: 'def-5', team: 'DEF', number: 5, relative_position: 'inside' },
        ],
        equipment: [],
        actions: [],
        moves: [],
      },
      'rondo-9v9'
    ),
    { currentFormat: current.pitch.format, message: '4v4 rondo' }
  );
  const after = solveBoardLayout(dsl, current);
  return {
    name: 'rondo-9v9-format',
    claim: '9v9 current + rondo stays 9V9 (not 7V7 from 2-3-1)',
    ok: after.pitch.format === '9V9' && dsl.grid.format === '9V9',
    lines: [`format=${after.pitch.format} dsl=${dsl.grid.format} shirts=${after.players.length}`],
  };
}

function caseRondoNeutralsFromAttExtras(): CaseResult {
  const parsed = parseBoardSymbolicDsl({
    activity: 'rondo',
    grid: { intent: 'rondo' },
    entities: [
      { id: 'att-4', team: 'ATT', number: 4, relative_position: 'perimeter' },
      { id: 'att-5', team: 'ATT', number: 5, relative_position: 'perimeter' },
      { id: 'att-6', team: 'ATT', number: 6, relative_position: 'perimeter' },
      { id: 'att-8', team: 'ATT', number: 8, relative_position: 'perimeter' },
      { id: 'att-10', team: 'ATT', number: 10, relative_position: 'inside' },
      { id: 'att-11', team: 'ATT', number: 11, relative_position: 'inside' },
      { id: 'def-6', team: 'DEF', number: 6, relative_position: 'inside' },
      { id: 'def-8', team: 'DEF', number: 8, relative_position: 'inside' },
      { id: 'def-4', team: 'DEF', number: 4, relative_position: 'inside' },
      { id: 'def-5', team: 'DEF', number: 5, relative_position: 'inside' },
    ],
  });
  if (!parsed.ok) {
    return {
      name: 'rondo-neutrals',
      claim: '4v4+2 extras painted ATT become NEUTRAL',
      ok: false,
      lines: [parsed.error],
    };
  }
  const after = solveBoardLayout(parsed.dsl);
  const neu = after.players.filter((p) => p.team === 'NEUTRAL').length;
  const att = after.players.filter((p) => p.team === 'ATT').length;
  const def = after.players.filter((p) => p.team === 'DEF').length;
  return {
    name: 'rondo-neutrals',
    claim: '4v4+2 extras painted ATT become NEUTRAL',
    ok: after.players.length === 10 && neu === 2 && att === 4 && def === 4,
    lines: [`ATT=${att} DEF=${def} NEUTRAL=${neu}`],
  };
}

function caseRondoMiniGoals(): CaseResult {
  const dsl = ensureDslEquipmentFromMessage(
    mustParse(
      {
        activity: 'rondo',
        seed: 'blank',
        grid: { intent: 'rondo', format: '7V7' },
        entities: [
          { id: 'att-4', team: 'ATT', number: 4, relative_position: 'perimeter' },
          { id: 'att-5', team: 'ATT', number: 5, relative_position: 'perimeter' },
          { id: 'def-6', team: 'DEF', number: 6, relative_position: 'inside' },
        ],
        equipment: [],
        actions: [],
        moves: [],
      },
      'rondo-minigoals'
    ),
    'Freeze this board and show a 4v4+2 rondo in the middle third with mini-goals'
  );
  const after = solveBoardLayout(dsl);
  const elements = after.elements ?? [];
  const goals = elements.filter((e) => e.kind === 'mini-goal');
  return {
    name: 'rondo-minigoals',
    claim: 'Asked mini-goals land on the rondo grid even if the DSL omitted kit',
    ok: goals.length === 2,
    lines: [`mini-goals=${goals.length} kit=${elements.length}`],
  };
}

function main() {
  console.log('\nDSL theory proof (no Gemini, no editor)\n');
  const results = [
    caseOverlap(),
    caseHallucination(),
    caseRondoNoUpsample(),
    caseImportOrientation(),
    caseTheirThird(),
    caseSeedCurrent(),
    caseFreeze(),
    caseUsGoalRight(),
    caseArrowIds(),
    caseGridBox(),
    caseAdmit7v7(),
    caseAdmitUnknownToken(),
    caseFunctionNotCurrent(),
    caseRondoTwoInside(),
    caseSeedCurrentTheirThird(),
    caseRondoRing(),
    caseRondoKeeps9v9(),
    caseRondoNeutralsFromAttExtras(),
    caseRondoMiniGoals(),
  ];
  const width = Math.max(...results.map((r) => r.claim.length));
  console.log(`${'RESULT'.padEnd(6)}  ${'CASE'.padEnd(22)}  CLAIM`);
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL '}  ${r.name.padEnd(22)}  ${r.claim}`);
    for (const line of r.lines) console.log(`        ${line}`);
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} claims proved`);
  console.log(`JSON dumps: ${samplesDir()}`);
  if (failed.length) {
    console.error(`Failed: ${failed.map((f) => f.name).join(', ')}`);
    process.exit(1);
  }
  console.log('\nTheory holds on these fixtures. Chat uses this path when BOARD_AI_SYMBOLIC_DSL=1.');
}

main();
