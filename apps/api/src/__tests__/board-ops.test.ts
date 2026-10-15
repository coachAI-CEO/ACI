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
