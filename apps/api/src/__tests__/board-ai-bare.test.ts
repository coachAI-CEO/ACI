import { carryModelArrows, stripAnnotations } from '../services/board-ai-bare';

const arrow = (id: string) => ({ id, type: 'pass', from: { x: 10, y: 10 }, to: { x: 20, y: 20 } }) as any;
const frame = (id: string, extra: any = {}) => ({ id, players: [], arrows: [arrow(`placed-${id}`)], areas: [{ x: 1, y: 1, width: 5, height: 5 }], labels: [{ text: 'note', x: 5, y: 5 }], ...extra }) as any;
const diagram = (frames: any[], extra: any = {}) => ({ pitch: {}, players: [], arrows: [arrow('root')], areas: [{ x: 1, y: 1, width: 5, height: 5 }], labels: [{ text: 'note', x: 5, y: 5 }], sequence: frames.length ? { frames, activeFrameId: frames[1]?.id ?? frames[0].id } : undefined, ...extra }) as any;

describe('stripAnnotations', () => {
  test('removes zone boxes and notes from the root and every frame, keeps arrows', () => {
    const out = stripAnnotations(diagram([frame('a'), frame('b'), frame('c')]));
    expect(out.areas).toEqual([]);
    expect(out.labels).toEqual([]);
    for (const f of out.sequence!.frames) {
      expect(f.areas).toEqual([]);
      expect(f.labels).toEqual([]);
      expect(f.arrows).toHaveLength(1);
    }
    expect(out.arrows).toHaveLength(1);
  });
  test('works on a board with no sequence', () => {
    const out = stripAnnotations(diagram([]));
    expect(out.areas).toEqual([]);
    expect(out.sequence).toBeUndefined();
  });
});

describe('carryModelArrows', () => {
  test("replaces the placement's arrows with the model's, frame by frame", () => {
    const placed = diagram([frame('a'), frame('b'), frame('c')]);
    const model = diagram([frame('x', { arrows: [arrow('m1')] }), frame('y', { arrows: [arrow('m2'), arrow('m3')] }), frame('z', { arrows: [] })]);
    const out = carryModelArrows(placed, model);
    expect(out.sequence!.frames.map((f: any) => f.arrows.map((a: any) => a.id))).toEqual([['m1'], ['m2', 'm3'], []]);
    expect(out.arrows!.map((a: any) => a.id)).toEqual(['m2', 'm3']); // root follows the active frame
  });
  test('a model that drew one picture puts its arrows on the active frame only', () => {
    const placed = diagram([frame('a'), frame('b'), frame('c')]);
    const model = diagram([], { arrows: [arrow('m1')] });
    const out = carryModelArrows(placed, model);
    expect(out.sequence!.frames.map((f: any) => f.arrows.length)).toEqual([0, 1, 0]);
  });
  test('model arrows that arrive without ids get ids', () => {
    const noId = { type: 'pass', from: { x: 1, y: 1 }, to: { x: 2, y: 2 } } as any;
    const out = carryModelArrows(diagram([frame('a'), frame('b')]), diagram([], { arrows: [noId, { ...noId }] }));
    const ids = out.sequence!.frames[1].arrows!.map((a: any) => a.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(2);
  });
  test('keeps the placement positions untouched', () => {
    const p = [{ id: 'p1', x: 33, y: 44, team: 'ATT' }];
    const placed = diagram([frame('a', { players: p }), frame('b', { players: p })]);
    const out = carryModelArrows(placed, diagram([]));
    expect(out.sequence!.frames[0].players).toEqual(p);
  });
  test('no placed frames: just the model arrows', () => {
    const out = carryModelArrows(diagram([]), diagram([], { arrows: [arrow('m')] }));
    expect(out.arrows!.map((a: any) => a.id)).toEqual(['m']);
  });
});
