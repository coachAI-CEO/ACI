import { build11v11FormationPlayers } from '../services/web-diagram-v1';
import { placePhaseSnapshot, roleBand } from '../services/board-phase-placement';
import { pressRelative } from '../services/board-press-relative';

const FORMATIONS = ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1'] as const;
const BLOCKS = ['high', 'mid', 'low'] as const;

function place(def: string, block: 'high' | 'mid' | 'low', relative: boolean, roster?: any[]) {
  const att = build11v11FormationPlayers('4-3-3', 'ATT');
  const defBase = build11v11FormationPlayers(def, 'DEF');
  if (relative) process.env.BOARD_PRESS_RELATIVE = '1';
  else delete process.env.BOARD_PRESS_RELATIVE;
  try {
    return placePhaseSnapshot({
      roster: roster || [...att, ...defBase],
      subPhase: 'goal_kick',
      attFormation: '4-3-3',
      defFormation: def as any,
      channelX: 50,
      defBlock: block,
      includeMotifArrows: false,
    });
  } finally {
    delete process.env.BOARD_PRESS_RELATIVE;
  }
}

/** Outfield players that were clearly on one side at base and ended up on the other. */
function sideFlips(base: any[], placed: any[]) {
  const byId = new Map(base.map((p) => [p.id, p]));
  return placed.filter((p) => {
    if (roleBand(p) === 'GK') return false;
    const b = byId.get(p.id);
    return b && Math.abs(b.x - 50) > 6 && Math.abs(p.x - 50) > 6 && Math.sign(b.x - 50) !== Math.sign(p.x - 50);
  });
}

describe('DEF goal-kick press keeps players on their own flank', () => {
  // Regression: placeDefBlock reused ATT's right/left width constants, so DEF's
  // right back / right mid / right CB were sent to the opposite touchline.
  for (const def of FORMATIONS) {
    for (const block of BLOCKS) {
      test(`${def} ${block} block (absolute placement)`, () => {
        const base = build11v11FormationPlayers(def, 'DEF');
        const out = place(def, block, false);
        expect(sideFlips(base, out.players.filter((p) => p.team === 'DEF'))).toEqual([]);
      });
    }
  }
});

describe('later phases keep the authored DEF layout', () => {
  // Regression: the flank fix once ran in every phase and re-sorted DEF players by
  // incoming position, clumping the 3-5-2 pocket #6 next to #8 and swapping #4/#5.
  function phase(def: string, ph: 'pocket' | 'final_third') {
    const roster = [...build11v11FormationPlayers('4-3-3', 'ATT'), ...build11v11FormationPlayers(def, 'DEF')];
    return placePhaseSnapshot({ roster, subPhase: ph, attFormation: '4-3-3', defFormation: def as any, channelX: 50, defBlock: 'high', includeMotifArrows: false }).players
      .filter((p) => p.team === 'DEF');
  }
  const at = (ps: any[], n: number) => ps.find((p) => p.number === n)!;

  test('3-5-2 pocket: #6 and #8 sit apart, #10 stays on the centre', () => {
    const ps = phase('3-5-2', 'pocket');
    expect(Math.abs(at(ps, 6).x - at(ps, 8).x)).toBeGreaterThanOrEqual(15);
    expect(Math.abs(at(ps, 10).x - 50)).toBeLessThanOrEqual(3);
  });

  test('3-5-2 pocket: centre back #4 stays on the centre, not shifted to a flank', () => {
    expect(Math.abs(at(phase('3-5-2', 'pocket'), 4).x - 50)).toBeLessThanOrEqual(3);
  });

  test('4-4-2 pocket: #8 and #6 keep their authored slots (x 62 and 38)', () => {
    const ps = phase('4-4-2', 'pocket');
    expect(at(ps, 8).x).toBeCloseTo(62, 0);
    expect(at(ps, 6).x).toBeCloseTo(38, 0);
  });
});

describe('BOARD_PRESS_RELATIVE press', () => {
  test('is off by default: identical to absolute placement', () => {
    const a = place('4-4-2', 'high', false);
    delete process.env.BOARD_PRESS_RELATIVE;
    const b = place('4-4-2', 'high', false);
    expect(b.players).toEqual(a.players);
  });

  for (const def of FORMATIONS) {
    test(`${def}: no side flips, lines stay ordered back < mid < front`, () => {
      const base = build11v11FormationPlayers(def, 'DEF');
      const defOut = place(def, 'high', true).players.filter((p) => p.team === 'DEF');
      expect(sideFlips(base, defOut)).toEqual([]);
      const mean = (band: string) => {
        const ys = defOut.filter((p) => roleBand(p) === band).map((p) => p.y);
        return ys.reduce((s, n) => s + n, 0) / ys.length;
      };
      expect(mean('BACK')).toBeLessThan(mean('MID'));
      expect(mean('MID')).toBeLessThan(mean('FRONT'));
    });
  }

  test('re-running on its own output does not drift', () => {
    const first = place('4-2-3-1', 'high', true);
    const second = place('4-2-3-1', 'high', true, first.players);
    const key = (ps: any[]) => ps.filter((p) => p.team === 'DEF').map((p) => [p.id, +p.x.toFixed(2), +p.y.toFixed(2)]);
    expect(key(second.players)).toEqual(key(first.players));
  });

  test('no two shirts end up stacked (spacing pass still applies)', () => {
    const players = place('4-2-3-1', 'high', true).players;
    let min = Infinity;
    for (let i = 0; i < players.length; i++)
      for (let j = i + 1; j < players.length; j++)
        min = Math.min(min, Math.hypot(players[i].x - players[j].x, players[i].y - players[j].y));
    // The overlap pass pushes pairs to the 5-unit cross-team boundary; allow solver rounding.
    expect(min).toBeGreaterThanOrEqual(4.99);
  });

  test('falls back to absolute placement for other phases', () => {
    process.env.BOARD_PRESS_RELATIVE = '1';
    const att = build11v11FormationPlayers('4-3-3', 'ATT');
    const def = build11v11FormationPlayers('4-4-2', 'DEF');
    const withFlag = placePhaseSnapshot({ roster: [...att, ...def], subPhase: 'pocket', attFormation: '4-3-3', defFormation: '4-4-2', channelX: 50, defBlock: 'high', includeMotifArrows: false });
    delete process.env.BOARD_PRESS_RELATIVE;
    const without = placePhaseSnapshot({ roster: [...att, ...def], subPhase: 'pocket', attFormation: '4-3-3', defFormation: '4-4-2', channelX: 50, defBlock: 'high', includeMotifArrows: false });
    expect(withFlag.players).toEqual(without.players);
  });
});

describe('pressRelative direction', () => {
  const ball = { x: 50, y: 50 };
  const p = (team: 'ATT' | 'DEF', y: number) => ({ id: `${team}-9`, number: 9, role: 'ST', team, x: 50, y });

  test('DEF presses toward increasing y, ATT toward decreasing y', () => {
    const def = pressRelative({ players: [p('DEF', 20) as any], team: 'DEF', ball, block: 'high', bandOf: roleBand });
    const att = pressRelative({ players: [p('ATT', 80) as any], team: 'ATT', ball, block: 'high', bandOf: roleBand });
    expect(def[0].y).toBeGreaterThan(20);
    expect(att[0].y).toBeLessThan(80);
  });

  test('never runs past the ball', () => {
    const out = pressRelative({ players: [p('DEF', 49) as any], team: 'DEF', ball, block: 'high', bandOf: roleBand });
    expect(out[0].y).toBeLessThanOrEqual(ball.y - 4);
  });

  test('lower blocks move less than higher blocks', () => {
    const y = (block: 'high' | 'mid' | 'low') =>
      pressRelative({ players: [p('DEF', 20) as any], team: 'DEF', ball: { x: 50, y: 95 }, block, bandOf: roleBand })[0].y;
    expect(y('low')).toBeLessThan(y('mid'));
    expect(y('mid')).toBeLessThan(y('high'));
  });

  test("leaves the other team's players alone", () => {
    const out = pressRelative({ players: [p('ATT', 80) as any], team: 'DEF', ball, block: 'high', bandOf: roleBand });
    expect(out[0].y).toBe(80);
  });
});
