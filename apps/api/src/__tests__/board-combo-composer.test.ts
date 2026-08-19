import {
  applyAttackingComboComposer,
  isPassingSequenceAsk,
  parseComboSlots,
  resolveComboChain,
  shouldComposeAttackingCombo,
} from '../services/board-combo-composer';
import { defaultMatchBoardDiagram } from '../services/web-diagram-v1';
import { parseWebDiagramV1 } from '../services/board-diagram-schema';

const ASK =
  'based on our board, create a passing sequence from the 6 to 8/10 to the 9 and then the 11';

describe('attacking combo composer', () => {
  const eleven = defaultMatchBoardDiagram('11V11');

  test('parses 6 → 8/10 → 9 → 11 from the board ask', () => {
    expect(isPassingSequenceAsk(ASK)).toBe(true);
    expect(shouldComposeAttackingCombo(ASK)).toBe(true);
    const slots = parseComboSlots(ASK);
    expect(slots.map((s) => s.numbers)).toEqual([[6], [8, 10], [9], [11]]);
  });

  test('does not treat a high press as a combo', () => {
    expect(shouldComposeAttackingCombo('High press in their third.')).toBe(false);
  });

  test('resolves the path onto live ATT shirts', () => {
    const chain = resolveComboChain(eleven.players, parseComboSlots(ASK));
    expect(chain.map((p) => p.number)).toEqual([6, expect.any(Number), 9, 11]);
    expect([8, 10]).toContain(chain[1].number);
    expect(chain.every((p) => p.team === 'ATT')).toBe(true);
  });

  test('D is one teaching slide of straight numbered passes', () => {
    const out = applyAttackingComboComposer(eleven, ASK, 'USSF_D')!;
    const frames = out.sequence?.frames || [];
    expect(frames[0].id).toBe('f-start');
    expect(frames[0].arrows).toHaveLength(0);
    expect(frames).toHaveLength(2);
    const play = frames[1];
    const passes = play.arrows.filter((a) => a.type === 'pass');
    expect(passes).toHaveLength(3);
    expect(passes.map((a) => a.order)).toEqual([1, 2, 3]);
    expect(play.arrows.every((a) => !a.control)).toBe(true);
    expect(play.players.map((p) => `${p.id}:${p.x}:${p.y}`)).toEqual(
      eleven.players.map((p) => `${p.id}:${p.x}:${p.y}`)
    );
  });

  test('B+ filmstrips the path with curves, hold, and a jump', () => {
    const out = applyAttackingComboComposer(eleven, ASK, 'USSF_B_PLUS')!;
    const frames = out.sequence?.frames || [];
    expect(frames.length).toBeGreaterThanOrEqual(4);
    const teaching = frames.slice(1);
    const allArrows = teaching.flatMap((f) => f.arrows);
    expect(allArrows.filter((a) => a.type === 'pass').length).toBeGreaterThanOrEqual(3);
    expect(allArrows.some((a) => a.type === 'run' && a.control)).toBe(true);
    expect(allArrows.some((a) => a.type === 'press')).toBe(true);
    expect(allArrows.some((a) => a.type === 'run' && !a.control)).toBe(true);
    for (const f of frames) {
      expect(f.players.map((p) => `${p.id}:${p.x}:${p.y}`)).toEqual(
        eleven.players.map((p) => `${p.id}:${p.x}:${p.y}`)
      );
    }
    const parsed = parseWebDiagramV1(out);
    expect(parsed.ok).toBe(true);
  });

  test('B+ is denser than D on the same path', () => {
    const d = applyAttackingComboComposer(eleven, ASK, 'USSF_D')!;
    const b = applyAttackingComboComposer(eleven, ASK, 'USSF_B_PLUS')!;
    const count = (diagram: typeof d) =>
      (diagram.sequence?.frames || []).reduce((n, f) => n + (f.arrows?.length || 0), 0);
    expect(count(b)).toBeGreaterThan(count(d));
    expect((b.sequence?.frames || []).length).toBeGreaterThan((d.sequence?.frames || []).length);
  });
});
