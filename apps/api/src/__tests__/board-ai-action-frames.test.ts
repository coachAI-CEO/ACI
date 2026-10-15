import { expandActionsToFrames, orderedActions, shouldExpandToFrames, MAX_ACTION_FRAMES } from '../services/board-ai-action-frames';
import { repairBoardDiagramWithSequence } from '../services/board-ai-chat';

const players = [
  { id: 'a3', team: 'ATT', number: 3, x: 10, y: 70 },
  { id: 'a7', team: 'ATT', number: 7, x: 80, y: 44 },
  { id: 'a9', team: 'ATT', number: 9, x: 50, y: 39 },
  { id: 'a8', team: 'ATT', number: 8, x: 35, y: 55 },
  { id: 'd4', team: 'DEF', number: 4, x: 60, y: 30 },
] as any[];
const pass = (from: string, to: string, extra: any = {}) => ({ type: 'pass', style: 'solid', weight: 'normal', from: { playerId: from }, to: { playerId: to }, ...extra });
const run = (from: string, x: number, y: number, extra: any = {}) => ({ type: 'run', style: 'dashed', weight: 'normal', from: { playerId: from }, to: { x, y }, ...extra });
const board = (arrows: any[], extra: any = {}) => ({ pitch: { orientation: 'HORIZONTAL' }, players, arrows, areas: [], labels: [], balls: [{ id: 'b', x: 50, y: 50 }], ...extra }) as any;
const frame = (d: any, i: number) => d.sequence.frames[i];
const ball = (d: any, i: number) => frame(d, i).balls[0];

describe('expandActionsToFrames', () => {
  const d = board([pass('a3', 'a7'), pass('a7', 'a9')]);
  const out = expandActionsToFrames(d);

  test('one frame per action plus a closing result frame', () => {
    expect(out.sequence!.frames).toHaveLength(3);
    expect(out.sequence!.frames.map((f: any) => f.id)).toEqual(['f-1', 'f-2', 'f-3']);
    expect(frame(out, 2).title).toBe('Result');
  });
  test('the ball is at the passer when each pass starts, and ends with the last receiver', () => {
    expect(ball(out, 0)).toMatchObject({ x: 10, y: 70 }); // A3 about to pass
    expect(ball(out, 1)).toMatchObject({ x: 80, y: 44 }); // A7 about to pass
    expect(ball(out, 2)).toMatchObject({ x: 50, y: 39 }); // A9 has it
  });
  test('only the current action is solid; the previous one stays as a faint ghost', () => {
    const f2 = frame(out, 1).arrows;
    expect(f2).toHaveLength(2);
    expect(f2.find((a: any) => a.to.playerId === 'a9').style).toBe('solid');
    expect(f2.find((a: any) => a.to.playerId === 'a7').style).toBe('dotted');
    expect(frame(out, 0).arrows).toHaveLength(1); // no ghost on the first step
  });
  test('titles name the players', () => {
    expect(frame(out, 0).title).toBe('ATT 3 passes to ATT 7');
    expect(frame(out, 1).title).toBe('ATT 7 passes to ATT 9');
  });
  test('the board itself starts on frame 1', () => {
    expect(out.sequence!.activeFrameId).toBe('f-1');
    expect(out.balls![0]).toMatchObject({ x: 10, y: 70 });
  });
});

describe('runs and carrying the ball', () => {
  test('the ball is with the first passer from the start, even when someone else runs first (an overlap)', () => {
    const out = expandActionsToFrames(board([run('a3', 15, 60), pass('a7', 'a9')]));
    expect(ball(out, 0)).toMatchObject({ x: 80, y: 44 }); // A7 has it while A3 overlaps
    expect(ball(out, 1)).toMatchObject({ x: 80, y: 44 });
  });
  test('a run moves the runner for the following frames, and the pass then goes to where he is', () => {
    const out = expandActionsToFrames(board([run('a9', 55, 20), pass('a8', 'a9')], { balls: [{ id: 'b', x: 35, y: 55 }] }));
    const a9 = (i: number) => frame(out, i).players.find((p: any) => p.id === 'a9');
    expect(a9(0)).toMatchObject({ x: 50, y: 39 }); // before the run
    expect(a9(1)).toMatchObject({ x: 55, y: 20 }); // after the run
    expect(ball(out, 2)).toMatchObject({ x: 55, y: 20 }); // pass arrived where A9 ran to
  });
  test('a runner who has the ball takes it with him', () => {
    const out = expandActionsToFrames(board([run('a8', 40, 30), pass('a8', 'a9')], { balls: [{ id: 'b', x: 35, y: 55 }] }));
    expect(ball(out, 1)).toMatchObject({ x: 40, y: 30 });
  });
});

describe('explicit order and context arrows', () => {
  test('arrows follow their order number, not the array position', () => {
    const arrows = [pass('a7', 'a9', { order: 2 }), pass('a3', 'a7', { order: 1 })];
    expect(orderedActions(arrows as any).map((a: any) => a.from.playerId)).toEqual(['a3', 'a7']);
  });
  test('press / cover lines stay on every frame', () => {
    const press = { type: 'press', style: 'solid', weight: 'normal', from: { playerId: 'd4' }, to: { playerId: 'a9' } };
    const out = expandActionsToFrames(board([pass('a3', 'a7'), pass('a7', 'a9'), press]));
    for (const f of out.sequence!.frames) expect(f.arrows!.some((a: any) => a.type === 'press')).toBe(true);
  });
  test(`never more than ${MAX_ACTION_FRAMES} actions (+ result)`, () => {
    const many = Array.from({ length: 9 }, (_, i) => pass(i % 2 ? 'a7' : 'a3', i % 2 ? 'a3' : 'a7'));
    expect(expandActionsToFrames(board(many)).sequence!.frames).toHaveLength(MAX_ACTION_FRAMES + 1);
  });
});

describe('shouldExpandToFrames', () => {
  test('needs two actions', () => {
    expect(shouldExpandToFrames(board([pass('a3', 'a7')]), true)).toBe(false);
  });
  test('needs the coach to ask for steps, the model to have numbered them, or the actions to chain', () => {
    const unrelated = board([pass('a3', 'a7'), pass('a8', 'a9')]);
    expect(shouldExpandToFrames(unrelated, false)).toBe(false);
    expect(shouldExpandToFrames(unrelated, true)).toBe(true);
    expect(shouldExpandToFrames(board([pass('a3', 'a7'), pass('a7', 'a9')]), false)).toBe(true); // 7 receives, then 7 passes
    expect(shouldExpandToFrames(board([pass('a3', 'a7', { order: 1 }), pass('a7', 'a9', { order: 2 })]), false)).toBe(true);
  });
  test('leaves a board that already has frames alone', () => {
    expect(shouldExpandToFrames(board([pass('a3', 'a7'), pass('a7', 'a9')], { sequence: { frames: [{ id: 'x' }], activeFrameId: 'x' } }), true)).toBe(false);
  });
});

describe('through the free-form pipeline (BOARD_AI_LIGHT_REPAIR=1)', () => {
  afterEach(() => { delete process.env.BOARD_AI_LIGHT_REPAIR; });
  test('"then" in the message turns two passes into a filmstrip, with the ball following', () => {
    process.env.BOARD_AI_LIGHT_REPAIR = '1';
    const out: any = repairBoardDiagramWithSequence(board([pass('a3', 'a7'), pass('a7', 'a9')]), 'Pass from ATT 3 to ATT 7, then ATT 7 plays it to ATT 9');
    expect(out.sequence.frames).toHaveLength(3);
    expect(ball(out, 0)).toMatchObject({ x: 10, y: 70 });
    expect(ball(out, 1)).toMatchObject({ x: 80, y: 44 });
  });
  test('a single pass stays one picture, with the ball at the passer', () => {
    process.env.BOARD_AI_LIGHT_REPAIR = '1';
    const out: any = repairBoardDiagramWithSequence(board([pass('a3', 'a7')]), 'Switch the ball from ATT 3 to ATT 7');
    expect(out.sequence).toBeUndefined();
    expect(out.balls[0]).toMatchObject({ x: 10, y: 70 });
  });
});

describe('expandPlayFrameIntoSteps (combo builder output: Start + one Play frame)', () => {
  const { expandPlayFrameIntoSteps } = require('../services/board-ai-action-frames');
  const startFrame = { id: 'f-start', title: '1. Start (board)', players, arrows: [], areas: [], labels: [], balls: [{ id: 'b', x: 50, y: 50 }] };
  const playFrame = { id: 'f-2', title: '2. Play', players, arrows: [run('a8', 40, 30, { order: 1 }), pass('a8', 'a9', { order: 2 }), pass('a9', 'a7', { order: 3 })], areas: [], labels: [], balls: [{ id: 'b', x: 35, y: 55 }] };
  const combo = () => board([], { sequence: { frames: [startFrame, playFrame], activeFrameId: 'f-2' } });

  test('keeps the Start frame and replaces Play with one frame per action plus a result', () => {
    const out = expandPlayFrameIntoSteps(combo());
    expect(out.sequence.frames.map((f: any) => f.id)).toEqual(['f-start', 'f-2', 'f-3', 'f-4', 'f-5']);
    expect(out.sequence.frames[0].arrows).toEqual([]);
    expect(out.sequence.frames[4].title).toBe('Result');
    expect(out.sequence.activeFrameId).toBe('f-2');
  });
  test('the ball goes with the runner and then to the receivers', () => {
    const out = expandPlayFrameIntoSteps(combo());
    const b = (i: number) => out.sequence.frames[i].balls[0];
    expect(b(1)).toMatchObject({ x: 35, y: 55 }); // A8 has it, about to run
    expect(b(2)).toMatchObject({ x: 40, y: 30 }); // carried to where A8 ran
    expect(b(3)).toMatchObject({ x: 50, y: 39 }); // A9 has it
    expect(b(4)).toMatchObject({ x: 80, y: 44 }); // A7 at the end
  });
  test('a Play frame with a single action is left as it is', () => {
    const one = board([], { sequence: { frames: [startFrame, { ...playFrame, arrows: [pass('a8', 'a9', { order: 1 })] }], activeFrameId: 'f-2' } });
    expect(expandPlayFrameIntoSteps(one)).toBe(one);
  });
});
