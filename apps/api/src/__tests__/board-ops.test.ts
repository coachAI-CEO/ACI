import { applyBoardOps, revisionOf, SUPPORTED_FORMATIONS, MAX_OPS } from '../services/board-ops';
import { build11v11FormationPlayers, DEFAULT_MATCH_BOARD_DIAGRAM } from '../services/web-diagram-v1';

const fresh = () => JSON.parse(JSON.stringify(DEFAULT_MATCH_BOARD_DIAGRAM)) as any;
const run = (ops: any[], d: any = fresh(), revision?: string) => applyBoardOps(d, { ops, revision });
const ok = (r: any) => { if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`); return r.diagram as any; };
const player = (d: any, team: string, n: number, frame?: any) => (frame ?? d).players.find((p: any) => p.team === team && p.number === n);

describe('moving and editing players', () => {
  test('move_player by team and shirt number', () => {
    const d = ok(run([{ op: 'move_player', player: { team: 'ATT', number: 9 }, x: 40, y: 30 }]));
    expect(player(d, 'ATT', 9)).toMatchObject({ x: 40, y: 30 });
  });
  test('move_player by id', () => {
    const base = fresh(); const id = player(base, 'DEF', 4).id;
    const d = ok(run([{ op: 'move_player', player: { playerId: id }, x: 11, y: 22 }], base));
    expect(player(d, 'DEF', 4)).toMatchObject({ x: 11, y: 22 });
  });
  test('add_player, update_player (renumber) and remove_player', () => {
    let d = ok(run([{ op: 'add_player', team: 'NEUTRAL', number: 20, x: 50, y: 50, role: 'N' }]));
    expect(player(d, 'NEUTRAL', 20)).toMatchObject({ x: 50, y: 50, role: 'N' });
    d = ok(run([{ op: 'update_player', player: { team: 'NEUTRAL', number: 20 }, patch: { number: 21, name: 'Joker' } }], d));
    expect(player(d, 'NEUTRAL', 21)).toMatchObject({ name: 'Joker' });
    d = ok(run([{ op: 'remove_player', player: { team: 'NEUTRAL', number: 21 } }], d));
    expect(player(d, 'NEUTRAL', 21)).toBeUndefined();
  });
  test('removing a player also removes the arrows attached to them, and says so', () => {
    const r: any = run([
      { op: 'add_arrow', type: 'pass', from: { team: 'ATT', number: 3 }, to: { team: 'ATT', number: 7 } },
      { op: 'remove_player', player: { team: 'ATT', number: 7 } },
    ]);
    expect(r.ok).toBe(true);
    expect(r.diagram.arrows).toHaveLength(0);
    expect(r.results[1].message).toContain('Removed 1 arrow');
  });
});

describe('precise errors the sender can act on', () => {
  const err = (ops: any[], d?: any) => { const r: any = run(ops, d); expect(r.ok).toBe(false); return r.error; };
  test('unknown player lists the numbers that exist', () => {
    const e = err([{ op: 'move_player', player: { team: 'ATT', number: 15 }, x: 1, y: 1 }]);
    expect(e).toMatchObject({ index: 0, code: 'no_such_player' });
    expect(e.message).toContain('ATT numbers present: 1, 2, 3');
  });
  test('out-of-range coordinates are rejected, not clamped', () => {
    expect(err([{ op: 'move_player', player: { team: 'ATT', number: 9 }, x: 140, y: 30 }])).toMatchObject({ code: 'out_of_range' });
  });
  test('unknown fields and unknown ops are rejected with the valid choices', () => {
    expect(err([{ op: 'move_player', player: { team: 'ATT', number: 9 }, x: 1, y: 1, speed: 3 }])).toMatchObject({ code: 'unknown_field' });
    expect(err([{ op: 'teleport' }]).message).toContain('Valid ops:');
  });
  test('duplicate shirt numbers are rejected', () => {
    expect(err([{ op: 'add_player', team: 'ATT', number: 9, x: 1, y: 1 }])).toMatchObject({ code: 'duplicate_player' });
  });
  test('an unsupported formation says which ones are supported', () => {
    const e = err([{ op: 'set_formation', team: 'ATT', formation: '3-4-3' }]);
    expect(e.code).toBe('unsupported_formation');
    for (const f of SUPPORTED_FORMATIONS) expect(e.message).toContain(f);
  });
  test('the batch size is bounded', () => {
    const many = Array.from({ length: MAX_OPS + 1 }, () => ({ op: 'set_ball', x: 50, y: 50 }));
    expect(err(many)).toMatchObject({ code: 'invalid_batch' });
  });
});

describe('all-or-nothing and revisions', () => {
  test('a failing operation leaves the board untouched, even if earlier ones were fine', () => {
    const base = fresh(); const before = JSON.stringify(base);
    const r: any = run([{ op: 'move_player', player: { team: 'ATT', number: 9 }, x: 5, y: 5 }, { op: 'move_player', player: { team: 'ATT', number: 99 }, x: 5, y: 5 }], base);
    expect(r.ok).toBe(false);
    expect(r.error.index).toBe(1);
    expect(JSON.stringify(base)).toBe(before);
  });
  test('an edit against a stale revision is rejected', () => {
    const base = fresh(); const rev = revisionOf(base);
    const d = ok(run([{ op: 'move_player', player: { team: 'ATT', number: 9 }, x: 5, y: 5 }], base, rev));
    const stale: any = run([{ op: 'set_ball', x: 1, y: 1 }], d, rev); // d has moved on
    expect(stale.ok).toBe(false);
    expect(stale.error.code).toBe('stale_revision');
  });
  test('revisions are stable for equal content and change when content changes', () => {
    expect(revisionOf(fresh())).toBe(revisionOf(fresh()));
    const d = ok(run([{ op: 'set_ball', x: 12, y: 34 }]));
    expect(revisionOf(d)).not.toBe(revisionOf(fresh()));
  });
});

describe('formations', () => {
  for (const f of SUPPORTED_FORMATIONS) {
    test(`set_formation ${f} gives exactly the app's template for that team`, () => {
      const d = ok(run([{ op: 'set_formation', team: 'DEF', formation: f }]));
      const want = build11v11FormationPlayers(f, 'DEF');
      const got = d.players.filter((p: any) => p.team === 'DEF');
      expect(got).toHaveLength(11);
      for (const w of want) expect(got.find((p: any) => p.number === w.number)).toMatchObject({ x: w.x, y: w.y });
      expect(d.players.filter((p: any) => p.team === 'ATT')).toHaveLength(11); // the other team is untouched
    });
  }
});

describe('ball and arrows', () => {
  test('set_ball by coordinates or at a carrier', () => {
    let d = ok(run([{ op: 'set_ball', carrier: { team: 'ATT', number: 3 } }]));
    const a3 = player(d, 'ATT', 3);
    expect(d.balls[0]).toMatchObject({ x: a3.x, y: a3.y });
    d = ok(run([{ op: 'set_ball', x: 20, y: 30 }], d));
    expect(d.balls[0]).toMatchObject({ x: 20, y: 30 });
    expect((run([{ op: 'set_ball', x: 1, y: 1, carrier: { team: 'ATT', number: 3 } }]) as any).error.code).toBe('invalid_value');
  });
  test('add_arrow by players or by points, with sensible styles', () => {
    const d = ok(run([
      { op: 'add_arrow', type: 'pass', from: { team: 'ATT', number: 3 }, to: { team: 'ATT', number: 7 }, order: 1 },
      { op: 'add_arrow', type: 'run', from: { team: 'ATT', number: 7 }, to: { x: 30, y: 20 }, order: 2 },
    ]));
    expect(d.arrows).toHaveLength(2);
    expect(d.arrows[0]).toMatchObject({ type: 'pass', style: 'solid', order: 1 });
    expect(d.arrows[1]).toMatchObject({ type: 'run', style: 'dashed', to: { x: 30, y: 20 } });
    expect(d.arrows[0].from.playerId).toBe(player(d, 'ATT', 3).id);
    expect(d.arrows.every((a: any) => a.id)).toBe(true);
  });
  test('update_arrow and remove_arrow address arrows by id', () => {
    let d = ok(run([{ op: 'add_arrow', type: 'pass', from: { team: 'ATT', number: 3 }, to: { team: 'ATT', number: 7 } }]));
    const id = d.arrows[0].id;
    d = ok(run([{ op: 'update_arrow', arrowId: id, patch: { style: 'dotted', weight: 'bold' } }], d));
    expect(d.arrows[0]).toMatchObject({ style: 'dotted', weight: 'bold' });
    d = ok(run([{ op: 'remove_arrow', arrowId: id }], d));
    expect(d.arrows).toHaveLength(0);
    expect((run([{ op: 'remove_arrow', arrowId: 'nope' }]) as any).error.code).toBe('no_such_arrow');
  });
});

describe('frames', () => {
  const steps = () => ok(run([
    { op: 'set_ball', carrier: { team: 'ATT', number: 3 } },
    { op: 'add_frame', title: 'Pass to 7' },
    { op: 'move_player', frame: 'f-2', player: { team: 'ATT', number: 7 }, x: 70, y: 40 },
    { op: 'set_ball', frame: 'f-2', carrier: { team: 'ATT', number: 7 } },
    { op: 'add_arrow', frame: 'f-1', type: 'pass', from: { team: 'ATT', number: 3 }, to: { team: 'ATT', number: 7 } },
  ]));

  test('add_frame turns a single picture into frames and copies it, so ids stay stable', () => {
    const d = steps();
    expect(d.sequence.frames.map((f: any) => f.id)).toEqual(['f-1', 'f-2']);
    expect(d.sequence.frames[1].title).toBe('Pass to 7');
    const ids = (f: any) => f.players.map((p: any) => p.id).sort();
    expect(ids(d.sequence.frames[0])).toEqual(ids(d.sequence.frames[1]));
  });
  test('an edit to one frame leaves the other frame alone', () => {
    const d = steps();
    const a7 = (i: number) => player(d, 'ATT', 7, d.sequence.frames[i]);
    expect(a7(1)).toMatchObject({ x: 70, y: 40 });
    expect(a7(0).x).not.toBe(70);
    expect(d.sequence.frames[0].arrows).toHaveLength(1);
    expect(d.sequence.frames[1].arrows).toHaveLength(0);
  });
  test('the root mirrors the active frame', () => {
    let d = steps();
    expect(d.arrows).toHaveLength(1); // active is f-1
    d = ok(run([{ op: 'set_active_frame', frame: 'f-2' }], d));
    expect(d.arrows).toHaveLength(0);
    expect(player(d, 'ATT', 7)).toMatchObject({ x: 70, y: 40 });
  });
  test('update_frame, remove_frame and the guards', () => {
    let d = steps();
    d = ok(run([{ op: 'update_frame', frame: 'f-2', title: 'Result', durationMs: 2500 }], d));
    expect(d.sequence.frames[1]).toMatchObject({ title: 'Result', durationMs: 2500 });
    expect((run([{ op: 'update_frame', frame: 'f-2', durationMs: 10 }], d) as any).error.code).toBe('out_of_range');
    d = ok(run([{ op: 'remove_frame', frame: 'f-1' }], d));
    expect(d.sequence.frames.map((f: any) => f.id)).toEqual(['f-2']);
    expect(d.sequence.activeFrameId).toBe('f-2');
    expect((run([{ op: 'remove_frame', frame: 'f-2' }], d) as any).error.code).toBe('last_frame');
  });
  test('naming a frame that does not exist lists the real ones', () => {
    const e = (run([{ op: 'move_player', frame: 'f-9', player: { team: 'ATT', number: 9 }, x: 1, y: 1 }], steps()) as any).error;
    expect(e.code).toBe('no_such_frame');
    expect(e.message).toContain('f-1, f-2');
  });
  test('a board holds at most 12 frames', () => {
    const r: any = run(Array.from({ length: 12 }, () => ({ op: 'add_frame' })));
    expect(r.ok).toBe(false);
    expect(r.error.code).toBe('too_many_frames');
  });
});

describe('a whole teaching sequence in one batch (what the AI would send)', () => {
  test('"3 passes to 7, then 7 passes to 9" as two frames with the ball following', () => {
    const d = ok(run([
      { op: 'set_ball', carrier: { team: 'ATT', number: 3 } },
      { op: 'add_arrow', type: 'pass', from: { team: 'ATT', number: 3 }, to: { team: 'ATT', number: 7 }, order: 1 },
      { op: 'add_frame', title: '7 to 9' },
      { op: 'set_ball', frame: 'f-2', carrier: { team: 'ATT', number: 7 } },
      { op: 'add_arrow', frame: 'f-2', type: 'pass', from: { team: 'ATT', number: 7 }, to: { team: 'ATT', number: 9 }, order: 2 },
    ]));
    const [f1, f2] = d.sequence.frames;
    expect(f1.balls[0]).toMatchObject({ x: player(d, 'ATT', 3, f1).x });
    expect(f2.balls[0]).toMatchObject({ x: player(d, 'ATT', 7, f2).x });
    expect(f2.arrows.some((a: any) => a.to.playerId === player(d, 'ATT', 9, f2).id)).toBe(true);
  });
});

describe('frame aliases, ghost arrows and clear_team', () => {
  test('"last" names the frame add_frame just made; "active" the active one', () => {
    const d = ok(run([
      { op: 'add_frame' },
      { op: 'move_player', frame: 'last', player: { team: 'ATT', number: 9 }, x: 11, y: 22 },
      { op: 'move_player', frame: 'active', player: { team: 'ATT', number: 9 }, x: 33, y: 44 },
    ]));
    expect(player(d, 'ATT', 9, d.sequence.frames[1])).toMatchObject({ x: 11, y: 22 });
    expect(player(d, 'ATT', 9, d.sequence.frames[0])).toMatchObject({ x: 33, y: 44 });
  });
  test('a new frame fades the previous step\'s arrows to dotted ghosts by default', () => {
    const d = ok(run([
      { op: 'add_arrow', type: 'pass', from: { team: 'ATT', number: 3 }, to: { team: 'ATT', number: 7 } },
      { op: 'add_frame' },
    ]));
    expect(d.sequence.frames[0].arrows[0].style).toBe('solid');
    expect(d.sequence.frames[1].arrows[0]).toMatchObject({ style: 'dotted', weight: 'normal' });
  });
  test('add_frame can keep or clear the previous arrows instead', () => {
    const base = [{ op: 'add_arrow', type: 'pass', from: { team: 'ATT', number: 3 }, to: { team: 'ATT', number: 7 } }];
    expect(ok(run([...base, { op: 'add_frame', arrows: 'keep' }])).sequence.frames[1].arrows[0].style).toBe('solid');
    expect(ok(run([...base, { op: 'add_frame', arrows: 'clear' }])).sequence.frames[1].arrows).toHaveLength(0);
    expect((run([{ op: 'add_frame', arrows: 'fade' }]) as any).error.code).toBe('invalid_value');
  });
  test('clear_team empties one team and the arrows attached to it', () => {
    const d = ok(run([
      { op: 'add_arrow', type: 'press', from: { team: 'DEF', number: 4 }, to: { team: 'ATT', number: 9 } },
      { op: 'clear_team', team: 'DEF' },
    ]));
    expect(d.players.filter((p: any) => p.team === 'DEF')).toHaveLength(0);
    expect(d.players.filter((p: any) => p.team === 'ATT')).toHaveLength(11);
    expect(d.arrows).toHaveLength(0);
  });
  test('a small-sided setup built from clear_team + add_player (4v4 and 2 neutrals)', () => {
    const adds = (team: string, xs: number[], y: number) => xs.map((x, i) => ({ op: 'add_player', team, number: i + 1, x, y }));
    const d = ok(run([{ op: 'clear_team', team: 'ATT' }, { op: 'clear_team', team: 'DEF' }, ...adds('ATT', [30, 40, 50, 60], 40), ...adds('DEF', [30, 40, 50, 60], 60), ...adds('NEUTRAL', [45, 55], 50)]));
    expect(['ATT', 'DEF', 'NEUTRAL'].map((t) => d.players.filter((p: any) => p.team === t).length)).toEqual([4, 4, 2]);
  });
});

describe('set_block', () => {
  const { toTeamFrame } = require('@aci/shared');
  const { roleBand } = require('../services/board-phase-placement');
  const depth = (d: any, team: 'ATT' | 'DEF') => {
    const o = d.players.filter((p: any) => p.team === team && p.number !== 1);
    return o.reduce((s: number, p: any) => s + toTeamFrame(team, p).v, 0) / o.length;
  };
  for (const team of ['ATT', 'DEF'] as const) {
    test(`${team}: high > mid > low in depth, in the team's own frame`, () => {
      const [h, m, l] = ['high', 'mid', 'low'].map((height) => depth(ok(run([{ op: 'set_block', team, height }])), team));
      expect(h).toBeGreaterThan(m);
      expect(m).toBeGreaterThan(l);
    });
    test(`${team}: a low block is deep (outfield average well inside their own half)`, () => {
      expect(depth(ok(run([{ op: 'set_block', team, height: 'low' }])), team)).toBeLessThan(35);
    });
  }
  test('widths and goalkeepers are untouched, and every line keeps its order', () => {
    const before = fresh();
    const d = ok(run([{ op: 'set_block', team: 'ATT', height: 'low' }], before));
    for (const p of d.players.filter((q: any) => q.team === 'ATT')) {
      const b = before.players.find((q: any) => q.id === p.id);
      if (p.number === 1) expect(p).toMatchObject({ x: b.x, y: b.y });
      else expect(p.x).toBeCloseTo(b.x, 5); // x is width for ATT: unchanged
    }
    const o = d.players.filter((p: any) => p.team === 'ATT' && p.number !== 1);
    const m = (band: string) => { const v = o.filter((p: any) => roleBand(p) === band).map((p: any) => toTeamFrame('ATT', p).v); return v.reduce((a: number, c: number) => a + c, 0) / v.length; };
    expect(m('BACK')).toBeLessThan(m('MID'));
    expect(m('MID')).toBeLessThan(m('FRONT'));
    expect(d.players.filter((p: any) => p.team === 'DEF').map((p: any) => [p.x, p.y])).toEqual(before.players.filter((p: any) => p.team === 'DEF').map((p: any) => [p.x, p.y]));
  });
  test('rejects a bad height and a team with too few outfield players', () => {
    expect((run([{ op: 'set_block', team: 'ATT', height: 'deep' }]) as any).error.code).toBe('invalid_value');
    const adds = [1, 2, 3].map((n) => ({ op: 'add_player', team: 'ATT', number: n, x: 50, y: 80 + n }));
    expect((run([{ op: 'clear_team', team: 'ATT' }, ...adds, { op: 'set_block', team: 'ATT', height: 'low' }]) as any).error.code).toBe('invalid_value');
  });
});

describe('metres: nudge_player and place_relative do the conversion exactly', () => {
  const base = () => fresh();
  test('forward is towards the opponent goal for both teams (ATT toward low y, DEF toward high y)', () => {
    const b = base();
    const a = player(ok(run([{ op: 'nudge_player', player: { team: 'ATT', number: 9 }, forward_m: 10.5 }], b)), 'ATT', 9);
    expect(a.y).toBeCloseTo(player(b, 'ATT', 9).y - 10, 1);
    const d = player(ok(run([{ op: 'nudge_player', player: { team: 'DEF', number: 9 }, forward_m: 10.5 }], base())), 'DEF', 9);
    expect(d.y).toBeCloseTo(player(base(), 'DEF', 9).y + 10, 1);
  });
  test('right is the player\'s own right: ATT right = higher x, DEF right = lower x; 6.8 m = 10 units of width', () => {
    const b = base();
    expect(player(ok(run([{ op: 'nudge_player', player: { team: 'ATT', number: 8 }, right_m: 6.8 }], b)), 'ATT', 8).x).toBeCloseTo(player(b, 'ATT', 8).x + 10, 1);
    expect(player(ok(run([{ op: 'nudge_player', player: { team: 'DEF', number: 8 }, right_m: 6.8 }], b)), 'DEF', 8).x).toBeCloseTo(player(b, 'DEF', 8).x - 10, 1);
  });
  test('"ten metres towards the left touchline" for ATT is right_m -10 = 14.7 units lower x', () => {
    const b = base();
    expect(player(ok(run([{ op: 'nudge_player', player: { team: 'ATT', number: 8 }, right_m: -10 }], b)), 'ATT', 8).x).toBeCloseTo(player(b, 'ATT', 8).x - 14.7, 1);
  });
  test('place_relative puts a player an exact distance from another: 5 m directly behind', () => {
    const d = ok(run([{ op: 'place_relative', player: { team: 'ATT', number: 6 }, to: { team: 'ATT', number: 8 }, forward_m: -5 }]));
    const a6 = player(d, 'ATT', 6), a8 = player(d, 'ATT', 8);
    expect(a6.x).toBeCloseTo(a8.x, 1);
    expect((a6.y - a8.y) * 1.05).toBeCloseTo(5, 0);
  });
  test('errors: nothing to move by, a moved-off-the-pitch result, self-reference, bad metres', () => {
    const err = (ops: any[]) => (run(ops) as any).error;
    expect(err([{ op: 'nudge_player', player: { team: 'ATT', number: 9 } }]).code).toBe('invalid_value');
    const off = err([{ op: 'nudge_player', player: { team: 'DEF', number: 2 }, right_m: 8 }]);
    expect(off.code).toBe('out_of_range');
    expect(off.message).toContain('nearest touchline'); // DEF #2 stands 6.8 m from it
    expect(off.message).toContain('smaller distance');
    expect(err([{ op: 'place_relative', player: { team: 'ATT', number: 9 }, to: { team: 'ATT', number: 9 }, forward_m: 1 }]).code).toBe('invalid_value');
    expect(err([{ op: 'nudge_player', player: { team: 'ATT', number: 9 }, forward_m: 'ten' }]).code).toBe('invalid_value');
  });
});

/*
 * Value: protects=op validation paths an AI sender hits (ambiguous shirt, patch guards, arrow endpoints, set_formation cleanup, add_frame targeting, batch shape); fails_when=a guard is dropped or a message loses its code; why_new=earlier blocks cover happy paths and the main errors only; seam=none; no_claim=none beyond protects
 */
describe('remaining validation and cleanup paths', () => {
  const err = (ops: any, d?: any) => { const r: any = applyBoardOps(d ?? fresh(), { ops }); expect(r.ok).toBe(false); return r.error; };

  test('a shirt number shared by two players is ambiguous and points at playerId', () => {
    const d = fresh();
    d.players.push({ ...player(d, 'ATT', 9), id: 'twin' });
    const e = err([{ op: 'move_player', player: { team: 'ATT', number: 9 }, x: 1, y: 1 }], d);
    expect(e).toMatchObject({ code: 'ambiguous_player' });
    expect(e.message).toContain('playerId');
    expect(ok(run([{ op: 'move_player', player: { playerId: 'twin' }, x: 7, y: 8 }], d)).players.find((p: any) => p.id === 'twin')).toMatchObject({ x: 7, y: 8 });
  });
  test('ops that are not a list, or an op that is not an object, are rejected', () => {
    expect(err('move everyone')).toMatchObject({ code: 'invalid_batch' });
    expect(err([])).toMatchObject({ code: 'invalid_batch' });
    expect(err([null])).toMatchObject({ index: 0, code: 'invalid_operation' });
  });
  test('update_player: empty patch, unknown patch field and a taken number are errors; group is stored', () => {
    const who = { team: 'ATT', number: 9 };
    expect(err([{ op: 'update_player', player: who, patch: {} }]).code).toBe('invalid_value');
    expect(err([{ op: 'update_player', player: who, patch: { speed: 3 } }]).code).toBe('unknown_field');
    expect(err([{ op: 'update_player', player: who, patch: { number: 3 } }]).code).toBe('duplicate_player');
    expect(player(ok(run([{ op: 'update_player', player: who, patch: { group: 'g-front' } }])), 'ATT', 9).group).toBe('g-front');
  });
  test('update_arrow can re-point either end at a player or a coordinate; a bad patch field is rejected', () => {
    let d = ok(run([{ op: 'add_arrow', type: 'pass', from: { team: 'ATT', number: 3 }, to: { team: 'ATT', number: 7 } }]));
    const id = d.arrows[0].id;
    d = ok(run([{ op: 'update_arrow', arrowId: id, patch: { from: { team: 'ATT', number: 8 }, to: { x: 12, y: 34 }, type: 'run' } }], d));
    expect(d.arrows[0]).toMatchObject({ type: 'run', from: { playerId: player(d, 'ATT', 8).id }, to: { x: 12, y: 34 } });
    expect(err([{ op: 'update_arrow', arrowId: id, patch: { colour: 'red' } }], d).code).toBe('unknown_field');
    expect(err([{ op: 'update_arrow', arrowId: id, patch: { to: { x: 5, y: 500 } } }], d).code).toBe('out_of_range');
  });
  test('set_formation drops arrows that pointed at the replaced players and says so', () => {
    const r: any = run([
      { op: 'add_arrow', type: 'press', from: { team: 'ATT', number: 9 }, to: { team: 'DEF', number: 4 } },
      { op: 'add_arrow', type: 'pass', from: { team: 'ATT', number: 3 }, to: { team: 'ATT', number: 7 } },
      { op: 'set_formation', team: 'DEF', formation: '3-5-2' },
    ]);
    expect(r.ok).toBe(true);
    expect(r.diagram.arrows.map((a: any) => a.type)).toEqual(['pass']);
    expect(r.results[2].message).toContain('Removed 1 arrow');
  });
  test('add_frame can copy or follow a named frame; naming a missing one is an error', () => {
    const base = [{ op: 'add_frame' }, { op: 'move_player', frame: 'last', player: { team: 'ATT', number: 9 }, x: 11, y: 22 }, { op: 'add_frame', copyFrom: 'f-1', after: 'f-1', title: 'From start' }];
    const d = ok(run(base));
    expect(d.sequence.frames.map((f: any) => f.id)).toEqual(['f-1', 'f-3', 'f-2']);
    expect(player(d, 'ATT', 9, d.sequence.frames[1]).x).not.toBe(11); // copied from f-1, not the moved f-2
    expect(err([{ op: 'add_frame' }, { op: 'add_frame', copyFrom: 'f-9' }]).code).toBe('no_such_frame');
    expect(err([{ op: 'add_frame' }, { op: 'add_frame', after: 'f-9' }]).code).toBe('no_such_frame');
  });
  test('frame ops on a board with no frames say to add one first', () => {
    expect(err([{ op: 'update_frame', title: 'x' }]).code).toBe('no_such_frame');
    expect(err([{ op: 'remove_frame' }]).code).toBe('no_such_frame');
    expect(err([{ op: 'move_player', frame: 'last', player: { team: 'ATT', number: 9 }, x: 1, y: 1 }]).message).toContain('add_frame');
  });
  test('update_arrow validates order like add_arrow does', () => {
    const d = ok(run([{ op: 'add_arrow', type: 'pass', from: { team: 'ATT', number: 3 }, to: { team: 'ATT', number: 7 } }]));
    expect(err([{ op: 'add_arrow', type: 'pass', from: { team: 'ATT', number: 3 }, to: { team: 'ATT', number: 7 }, order: 40 }]).code).toBe('invalid_value');
    expect(err([{ op: 'update_arrow', arrowId: d.arrows[0].id, patch: { order: 40 } }], d).code).toBe('invalid_value');
  });
});

describe('review fixes (QA probes 002, 003, 004 and the specialist findings)', () => {
  test('add_frame on a single picture keeps goals, cones and elements in the frame and after the root mirror', () => {
    const b = fresh();
    b.cones = [{ id: 'c1', x: 30, y: 30 }];
    b.elements = [{ id: 'el1', kind: 'cone', x: 40, y: 40 }];
    const goals = b.goals?.length ?? 0;
    const d = ok(run([{ op: 'add_frame' }, { op: 'set_active_frame', frame: 'f-2' }], b));
    for (const f of d.sequence.frames) {
      expect(f.cones).toHaveLength(1);
      expect(f.elements).toHaveLength(1);
      expect(f.goals?.length ?? 0).toBe(goals);
    }
    expect(d.cones).toHaveLength(1);
    expect(d.elements).toHaveLength(1);
    expect(d.goals?.length ?? 0).toBe(goals);
  });
  test('set_block with a lowercase gk keeper keeps every coordinate finite (and leaves the keeper alone)', () => {
    const d = ok(run([
      { op: 'update_player', player: { team: 'ATT', number: 1 }, patch: { number: 30 } },
      { op: 'update_player', player: { team: 'ATT', number: 30 }, patch: { role: 'gk' } },
      { op: 'set_block', team: 'ATT', height: 'low' },
    ]));
    for (const p of d.players) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
    expect(player(d, 'ATT', 30)).toMatchObject({ x: player(fresh(), 'ATT', 1).x, y: player(fresh(), 'ATT', 1).y });
  });
  test('set_block with an empty midfield band still places every outfield player on the pitch, lines in order', () => {
    const adds = [
      { op: 'add_player', team: 'ATT', number: 1, x: 50, y: 94, role: 'GK' },
      { op: 'add_player', team: 'ATT', number: 4, x: 40, y: 80, role: 'CB' },
      { op: 'add_player', team: 'ATT', number: 5, x: 60, y: 80, role: 'CB' },
      { op: 'add_player', team: 'ATT', number: 9, x: 45, y: 40, role: 'ST' },
      { op: 'add_player', team: 'ATT', number: 10, x: 55, y: 40, role: 'ST' },
    ];
    const d = ok(run([{ op: 'clear_team', team: 'ATT' }, ...adds, { op: 'set_block', team: 'ATT', height: 'low' }]));
    for (const p of d.players.filter((q: any) => q.team === 'ATT')) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(100);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(100);
    }
    expect(player(d, 'ATT', 4).y).toBeGreaterThan(player(d, 'ATT', 9).y); // ATT defends the high-y goal: backs sit at higher y than forwards
  });
  test('op names that exist on Object.prototype are rejected with unknown_op, never thrown', () => {
    for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      const r: any = run([{ op: name }]);
      expect(r.ok).toBe(false);
      expect(r.error.code).toBe('unknown_op');
    }
  });
  test('an unexpected exception inside an operation becomes invalid_operation, not a throw', () => {
    const r: any = run([{ op: 'move_player', player: { team: 'ATT', get number(): number { throw new Error('boom'); } }, x: 1, y: 1 }]);
    expect(r.ok).toBe(false);
    expect(r.error.code).toBe('invalid_operation');
  });
  test('frame titles are capped at the normaliser\'s 80 characters and hold time at its 400-12000 ms range', () => {
    const long = 'x'.repeat(300);
    const d = ok(run([{ op: 'add_frame', title: long }, { op: 'update_frame', frame: 'f-1', title: long }]));
    expect(d.sequence.frames[1].title).toHaveLength(80);
    expect(d.sequence.frames[0].title).toHaveLength(80);
    expect((run([{ op: 'add_frame', title: { not: 'a string' } }]) as any).ok).toBe(true); // coerced, never stored as an object
    for (const ms of [399, 12001]) expect((run([{ op: 'add_frame' }, { op: 'update_frame', frame: 'f-1', durationMs: ms }]) as any).error.code).toBe('out_of_range');
    expect(ok(run([{ op: 'add_frame' }, { op: 'update_frame', frame: 'f-1', durationMs: 400 }])).sequence.frames[0].durationMs).toBe(400);
  });
  test('metre moves and set_formation are refused on boards that are not 11v11', () => {
    const small = { ...fresh(), pitch: { ...fresh().pitch, format: '7V7' } };
    for (const op of [
      { op: 'nudge_player', player: { team: 'ATT', number: 9 }, forward_m: 5 },
      { op: 'place_relative', player: { team: 'ATT', number: 6 }, to: { team: 'ATT', number: 8 }, forward_m: -5 },
      { op: 'set_formation', team: 'ATT', formation: '4-3-3' },
    ]) {
      const r: any = run([op], small);
      expect(r.ok).toBe(false);
      expect(r.error.code).toBe('unsupported_pitch');
      expect(r.error.message).toContain('7V7');
    }
    expect((run([{ op: 'nudge_player', player: { team: 'ATT', number: 9 }, forward_m: 5 }]) as any).ok).toBe(true); // the default board is 11v11
  });
});
