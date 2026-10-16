// Value: protects=runBoardAiChat's flag wiring: ops mode is entered only when BOARD_AI_OPS=1 and no image is attached, the default path never reaches the ops prompt, and BOARD_AI_BARE strips zone boxes and notes from a play-out; fails_when=the `!hasImage` guard, the flag check or the stripAnnotations call is removed or inverted; why_new=the pieces are unit-tested but nothing drove the 5000-line chat entry point with the flags; seam=none (jest.mock of the model module and prisma, as other tests here do); no_claim=real model output (the model is mocked) and the legacy drawing quality
jest.mock('../prisma', () => ({ prisma: {} }));
jest.mock('../services/game-model-templates', () => ({
  ...jest.requireActual('../services/game-model-templates'),
  getGameModelTemplate: jest.fn().mockResolvedValue(null),
  getGameModelTemplatePhilosophy: jest.fn().mockResolvedValue(null),
}));
jest.mock('../gemini', () => ({
  generateText: jest.fn(),
  generateMultimodalText: jest.fn(),
  setMetricsContext: jest.fn(),
  clearMetricsContext: jest.fn(),
}));

import { generateMultimodalText, generateText } from '../gemini';
import { runBoardAiChat } from '../services/board-ai-chat';
import { DEFAULT_MATCH_BOARD_DIAGRAM } from '../services/web-diagram-v1';

const gen = generateText as jest.Mock;
const genImage = generateMultimodalText as jest.Mock;
const board = () => JSON.parse(JSON.stringify(DEFAULT_MATCH_BOARD_DIAGRAM));
const call = (message: string, extra: any = {}) =>
  runBoardAiChat({ diagram: board(), message, history: [], ageGroup: 'U13', gameModelId: 'POSSESSION', coachLevel: 'USSF_C', ...extra });
const FLAGS = ['BOARD_AI_OPS', 'BOARD_AI_BARE', 'BOARD_AI_LIGHT_REPAIR', 'BOARD_RELATIVE_PRESETS', 'BOARD_AI_SYMBOLIC_DSL'];

beforeEach(() => {
  gen.mockReset();
  genImage.mockReset();
  for (const f of FLAGS) delete process.env[f]; // hermetic: a developer's .env must not leak in
});
afterEach(() => {
  for (const f of FLAGS) delete process.env[f];
});

describe('BOARD_AI_OPS', () => {
  const opsReply = JSON.stringify({ reply: 'Moved the nine.', ops: [{ op: 'move_player', player: { team: 'ATT', number: 9 }, x: 40, y: 30 }] });

  test('on, no image: the model is asked for operations and they are applied to the current board', async () => {
    process.env.BOARD_AI_OPS = '1';
    gen.mockResolvedValue(opsReply);
    const r = await call('Move our #9 to the edge of the box');
    expect(gen).toHaveBeenCalledTimes(1);
    expect(gen.mock.calls[0][0]).toContain('COACH REQUEST: Move our #9 to the edge of the box');
    expect(gen.mock.calls[0][0]).toContain('OPERATIONS');
    expect(r.applied).toBe(true);
    expect(r.reply).toBe('Moved the nine.');
    expect(r.diagram.players.find((p) => p.team === 'ATT' && p.number === 9)).toMatchObject({ x: 40, y: 30 });
    expect(r.coachLevel).toBeDefined(); // the result keeps the fields the old path returned
  });

  test('off (the default): the operations prompt is never used', async () => {
    gen.mockResolvedValue('not json');
    const r = await call('Move our #9 to the edge of the box');
    for (const [prompt] of gen.mock.calls) expect(prompt).not.toContain('sending operations');
    expect(r.applied).toBe(false);
  });

  test('on, but an image is attached: the legacy image path runs, not the operations path', async () => {
    process.env.BOARD_AI_OPS = '1';
    genImage.mockResolvedValue('not json');
    await call('Recreate this', { image: { mimeType: 'image/png', data: 'AAAA' } });
    expect(genImage).toHaveBeenCalled();
    for (const [prompt] of gen.mock.calls) expect(String(prompt)).not.toContain('sending operations');
  });

  test('on, the model returns garbage twice: the board is returned unchanged and applied is false', async () => {
    process.env.BOARD_AI_OPS = '1';
    gen.mockResolvedValue('I will not answer in JSON');
    const before = board();
    const r = await call('Move our #9 to the edge of the box');
    expect(r.applied).toBe(false);
    expect(r.diagram.players.map((p) => [p.x, p.y])).toEqual(before.players.map((p: any) => [p.x, p.y]));
    expect(gen).toHaveBeenCalledTimes(2); // one retry, never more
  });
});

describe('BOARD_AI_BARE on a play-out request', () => {
  const modelDiagram = () => {
    const d = board();
    d.arrows = [{ id: 'm1', type: 'pass', style: 'solid', weight: 'normal', from: { playerId: d.players.find((p: any) => p.team === 'ATT' && p.number === 3).id }, to: { playerId: d.players.find((p: any) => p.team === 'ATT' && p.number === 7).id } }];
    return d;
  };
  const run = async () => {
    gen.mockResolvedValue(JSON.stringify({ reply: 'Build-out.', diagram: modelDiagram() }));
    return call('Goal kick build-out, 4-3-3 vs 4-4-2 high press');
  };
  const layers = (d: any) => [d, ...(d.sequence?.frames ?? [])];

  test('default: the placement draws its zone boxes and caption notes', async () => {
    const r = await run();
    expect(layers(r.diagram).some((l: any) => (l.areas?.length ?? 0) > 0)).toBe(true);
    expect(layers(r.diagram).some((l: any) => (l.labels?.length ?? 0) > 0)).toBe(true);
  });

  test('bare: no zone boxes or notes anywhere, and the model\'s own arrow replaces the preset arrows', async () => {
    process.env.BOARD_AI_BARE = '1';
    const r = await run();
    for (const l of layers(r.diagram)) {
      expect(l.areas ?? []).toEqual([]);
      expect(l.labels ?? []).toEqual([]);
    }
    const arrowCount = layers(r.diagram).reduce((n: number, l: any) => n + (l.arrows?.length ?? 0), 0);
    expect(arrowCount).toBeGreaterThan(0);
    expect(arrowCount).toBeLessThan(6); // the preset motif arrows (about 13 across three frames) are gone
  });
});
