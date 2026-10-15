import { buildOpsPrompt, buildVerifyPrompt, describeBoard, parseOpsReply, runBoardAiOps } from '../services/board-ai-ops';
import { DEFAULT_MATCH_BOARD_DIAGRAM } from '../services/web-diagram-v1';

const board = () => JSON.parse(JSON.stringify(DEFAULT_MATCH_BOARD_DIAGRAM)) as any;
const reply = (ops: any[], text = 'Done.') => JSON.stringify({ reply: text, ops });

describe('what the model is shown', () => {
  test('the board description lists every player with number, role and position, and the revision', () => {
    const d = describeBoard(board());
    expect(d).toMatch(/revision: [0-9a-f]{10}/);
    expect(d).toContain('ATT (blue, us):');
    expect(d).toContain('DEF (red, them):');
    expect(d.match(/\d+ [A-Z]+ \(\d+,\d+\)/g)!.length).toBeGreaterThanOrEqual(22);
    expect(d).toContain('frames: none');
  });
  test('the prompt carries the rules, the operations, the board and the coach request', () => {
    const p = buildOpsPrompt({ diagram: board(), message: 'Pass from ATT 3 to ATT 7', history: [{ role: 'user', content: 'hi' }] });
    for (const must of ['ONLY JSON', 'set_formation', 'add_arrow', 'add_frame', 'CURRENT BOARD:', 'COACH REQUEST: Pass from ATT 3 to ATT 7', 'Supported: 4-3-3, 4-4-2, 4-2-3-1, 3-5-2']) expect(p).toContain(must);
  });
  test('parseOpsReply reads fenced or bare JSON and rejects anything without an ops list', () => {
    expect(parseOpsReply('```json\n{"reply":"ok","ops":[{"op":"set_ball","x":1,"y":2}]}\n```')!.ops).toHaveLength(1);
    expect(parseOpsReply('{"reply":"only text"}')).toBeNull();
    expect(parseOpsReply('not json')).toBeNull();
  });
});

describe('runBoardAiOps', () => {
  test('applies the model\'s operations to the current board', async () => {
    const r = await runBoardAiOps({ diagram: board(), message: 'x', call: async () => reply([{ op: 'move_player', player: { team: 'ATT', number: 9 }, x: 40, y: 30 }], 'Moved the nine.') });
    expect(r.applied).toBe(true);
    expect(r.attempts).toBe(1);
    expect(r.reply).toBe('Moved the nine.');
    expect(r.diagram.players.find((p: any) => p.team === 'ATT' && p.number === 9)).toMatchObject({ x: 40, y: 30 });
  });
  test('a rejected batch is retried once with the exact error, then applied', async () => {
    const prompts: string[] = [];
    const r = await runBoardAiOps({
      diagram: board(), message: 'x',
      call: async (p) => { prompts.push(p); return prompts.length === 1 ? reply([{ op: 'set_formation', team: 'ATT', formation: '3-4-3' }]) : reply([{ op: 'set_formation', team: 'ATT', formation: '4-3-3' }], 'Used 4-3-3.'); },
    });
    expect(r.attempts).toBe(2);
    expect(r.applied).toBe(true);
    expect(prompts[1]).toContain('REJECTED');
    expect(prompts[1]).toContain('unsupported_formation');
    expect(prompts[1]).toContain('Supported: 4-3-3, 4-4-2, 4-2-3-1, 3-5-2');
  });
  test('two failures leave the board unchanged and say why', async () => {
    const d = board();
    const r = await runBoardAiOps({ diagram: d, message: 'x', call: async () => reply([{ op: 'move_player', player: { team: 'ATT', number: 99 }, x: 1, y: 1 }]) });
    expect(r.applied).toBe(false);
    expect(r.diagram).toBe(d);
    expect(r.reply).toContain('the board is unchanged');
    expect(r.reply).not.toContain('Done.');
    expect(r.error).toContain('no_such_player');
  });
  test('an unreadable reply is retried, and "ops: []" means a question with no change', async () => {
    let n = 0;
    const r = await runBoardAiOps({ diagram: board(), message: 'why?', call: async () => (++n === 1 ? 'sorry, here is some prose' : reply([], 'Because the 9 pins the centre-backs.')) });
    expect(r.attempts).toBe(2);
    expect(r.applied).toBe(false);
    expect(r.reply).toBe('Because the 9 pins the centre-backs.');
  });
  test('a multi-step request becomes frames with the ball following', async () => {
    const ops = [
      { op: 'set_ball', carrier: { team: 'ATT', number: 3 } },
      { op: 'add_arrow', type: 'pass', from: { team: 'ATT', number: 3 }, to: { team: 'ATT', number: 7 } },
      { op: 'add_frame' },
      { op: 'set_ball', frame: 'last', carrier: { team: 'ATT', number: 7 } },
      { op: 'add_arrow', frame: 'last', type: 'pass', from: { team: 'ATT', number: 7 }, to: { team: 'ATT', number: 9 } },
    ];
    const r = await runBoardAiOps({ diagram: board(), message: 'x', call: async () => reply(ops) });
    expect(r.applied).toBe(true);
    const fr = (r.diagram as any).sequence.frames;
    expect(fr).toHaveLength(2);
    expect(fr[1].arrows.map((a: any) => a.style).sort()).toEqual(['dotted', 'solid']);
  });
});

describe('rules for blocks, vague requests and not guessing', () => {
  const p = buildOpsPrompt({ diagram: board(), message: 'x', history: [] });
  test('the prompt tells the model to show the situation, use blocks, ask when unclear, and not invent or clear players', () => {
    for (const must of ['105 m long and 68 m wide', 'nudge_player', 'place_relative', 'NEVER convert metres', 'their right touchline is the bottom', 'DO move players to the places the scenario states', 'set_block', 'do NOT guess', 'Only add a player when the coach says add', 'Do not remove or clear players unless', 'never claim a change you did not make']) expect(p).toContain(must);
  });
});

describe('verify pass', () => {
  test('corrective operations from the check are applied on top of the first result', async () => {
    const calls: string[] = [];
    const r = await runBoardAiOps({
      diagram: board(), message: 'Put our #9 on the penalty spot', verify: true,
      call: async (pr) => { calls.push(pr); return calls.length === 1 ? reply([{ op: 'set_ball', x: 50, y: 50 }], 'Ball set.') : JSON.stringify({ ok: false, problem: 'the 9 is not on the spot', ops: [{ op: 'move_player', player: { team: 'ATT', number: 9 }, x: 50, y: 11 }] }); },
    });
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain('Check your own work');
    expect(r.diagram.players.find((q: any) => q.team === 'ATT' && q.number === 9)).toMatchObject({ x: 50, y: 11 });
    expect(r.opsApplied).toBe(2);
  });
  test('"ok" leaves the first result alone, and a bad correction is ignored', async () => {
    let n = 0;
    const ok = await runBoardAiOps({ diagram: board(), message: 'x', verify: true, call: async () => (++n === 1 ? reply([{ op: 'set_ball', x: 20, y: 20 }]) : JSON.stringify({ ok: true, ops: [] })) });
    expect(ok.opsApplied).toBe(1);
    n = 0;
    const bad = await runBoardAiOps({ diagram: board(), message: 'x', verify: true, call: async () => (++n === 1 ? reply([{ op: 'set_ball', x: 20, y: 20 }]) : JSON.stringify({ ok: false, ops: [{ op: 'move_player', player: { team: 'ATT', number: 99 }, x: 1, y: 1 }] })) });
    expect(bad.applied).toBe(true);
    expect(bad.opsApplied).toBe(1);
    expect(bad.diagram.balls![0]).toMatchObject({ x: 20, y: 20 });
  });
  test('verify is off by default (no second call)', async () => {
    let n = 0;
    await runBoardAiOps({ diagram: board(), message: 'x', call: async () => { n++; return reply([{ op: 'set_ball', x: 20, y: 20 }]); } });
    expect(n).toBe(1);
  });
  test('the verify prompt shows the request, the operations and the board as it now is', () => {
    const vp = buildVerifyPrompt({ diagram: board(), message: 'hello', ops: [{ op: 'set_ball', x: 1, y: 2 }] });
    for (const must of ['COACH REQUEST: hello', 'OPERATIONS YOU SENT:', 'BOARD NOW:', '"ok": true']) expect(vp).toContain(must);
  });
});
