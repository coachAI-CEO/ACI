/**
 * AI that drives the board through operations (BOARD_AI_OPS=1).
 *
 * The model never returns a board. It returns a short coaching reply plus a list of small operations
 * (board-ops.ts) which the server applies to the CURRENT board: validated, atomic, revision-guarded.
 * If a batch is rejected, the exact error goes back to the model once so it can correct itself.
 */
import { generateText, setMetricsContext, clearMetricsContext } from '../gemini';
import { applyBoardOps, revisionOf, SUPPORTED_FORMATIONS } from './board-ops';
import type { WebDiagramV1 } from './web-diagram-v1';

export const boardOpsEnabled = () => process.env.BOARD_AI_OPS === '1';

type Chat = { role: 'user' | 'assistant'; content: string };

const pt = (p: { x: number; y: number }) => `(${Math.round(p.x)},${Math.round(p.y)})`;

/** A compact, exact description of the board the model is editing. */
export function describeBoard(d: WebDiagramV1): string {
  const frames = d.sequence?.frames || [];
  const active = d.sequence?.activeFrameId;
  const layers = (frames.find((f) => f.id === active) ?? frames[0] ?? d) as unknown as WebDiagramV1;
  const team = (t: string, label: string) => {
    const ps = (layers.players || []).filter((p) => p.team === t).sort((a, b) => (a.number ?? 99) - (b.number ?? 99));
    return ps.length ? `${label}: ${ps.map((p) => `${p.number ?? '?'}${p.role ? ' ' + p.role : ''} ${pt(p)}`).join(' | ')}` : `${label}: none`;
  };
  const num = (id?: string) => {
    const p = (layers.players || []).find((q) => q.id === id);
    return p ? `${p.team} ${p.number}` : 'point';
  };
  const arrows = (layers.arrows || []).map((a) => `${a.id}: ${a.type} ${num(a.from.playerId)}->${num(a.to.playerId)} ${a.style}`);
  return [
    `revision: ${revisionOf(d)}`,
    frames.length ? `frames: ${frames.map((f) => `${f.id}${f.id === active ? ' (active)' : ''}${f.title ? ` "${f.title}"` : ''}`).join(', ')}` : 'frames: none (single picture)',
    team('ATT', 'ATT (blue, us)'),
    team('DEF', 'DEF (red, them)'),
    team('NEUTRAL', 'NEUTRAL'),
    `ball: ${(layers.balls || []).length ? pt(layers.balls![0]) : 'none'}`,
    `arrows: ${arrows.length ? arrows.join('; ') : 'none'}`,
  ].join('\n');
}

const OPS_REFERENCE = `OPERATIONS (all coordinates 0-100; each op may add "frame": "<id>" | "last" | "active", default active):
 {"op":"set_formation","team":"ATT"|"DEF","formation":"${SUPPORTED_FORMATIONS.join('"|"')}"}   replaces that team with the exact template
 {"op":"clear_team","team":"ATT"|"DEF"|"NEUTRAL"}
 {"op":"add_player","team":"ATT"|"DEF"|"NEUTRAL","number":1-99,"x":..,"y":..,"role":"optional"}
 {"op":"move_player","player":{"team":"ATT","number":9},"x":..,"y":..}
 {"op":"update_player","player":{...},"patch":{"role":..,"number":..,"name":..}}
 {"op":"remove_player","player":{...}}
 {"op":"set_ball","carrier":{"team":"ATT","number":3}}   or   {"op":"set_ball","x":..,"y":..}
 {"op":"add_arrow","type":"pass"|"run"|"press"|"cover"|"transition","from":{"team":"ATT","number":3},"to":{"team":"ATT","number":7} or {"x":..,"y":..},"order":1}
 {"op":"update_arrow","arrowId":"..","patch":{"style":"solid"|"dashed"|"dotted","weight":"normal"|"bold"}}
 {"op":"remove_arrow","arrowId":".."}
 {"op":"add_frame","title":"..","arrows":"ghost"|"keep"|"clear"}   copies the active frame (previous arrows fade to dotted); then use "frame":"last"
 {"op":"update_frame","frame":"..","title":"..","note":"..","durationMs":120-20000}
 {"op":"remove_frame","frame":".."}   {"op":"set_active_frame","frame":".."}`;

const RULES = `PITCH: horizontal. y runs goal to goal: ATT (blue, us) defends the RIGHT goal (y near 100) and attacks LEFT (toward y 0); DEF (red, them) defends the LEFT goal (y near 0) and attacks RIGHT. x is width: ATT's right side is the TOP of the screen (high x); DEF's right side is the BOTTOM (low x).
RULES:
- Reply with ONLY JSON: {"reply": "<1-4 plain coaching sentences>", "ops": [ ... ]}. No other text.
- Address players by team and shirt number as listed on the board. Never invent a player that is not listed unless the coach asks for new players.
- Change only what the coach asked for. A request for arrows or passes means arrows and the ball only: do not move players.
- Named formations: use set_formation. Supported: ${SUPPORTED_FORMATIONS.join(', ')}. If the coach asks for another formation, use the closest supported one and SAY so in "reply".
- Small-sided or custom setups (rondos, 7v7, 9v9): clear_team for both teams, then add_player for exactly the players asked for (and NEUTRAL players if asked), spread sensibly and at least 6 apart.
- Several moves in order ("A passes to B, then B to C"): one frame per move. Put the first move on the current frame, then add_frame and put the next move on frame "last". Start each move with set_ball carrier = the player who plays it, and end with a final frame showing the ball with the last receiver. At most 6 moves.
- A pass is a "pass" arrow from the passer to the receiver; a run is a "run" arrow from the runner to the target point.
- If the request needs no board change (a question), return "ops": [].`;

export function buildOpsPrompt(input: { diagram: WebDiagramV1; message: string; history: Chat[]; retryNote?: string }): string {
  const hist = input.history.slice(-6).map((h) => `${h.role === 'user' ? 'Coach' : 'You'}: ${h.content.slice(0, 600)}`).join('\n');
  return [
    'You are Tactical Edge AI, editing a soccer tactics board by sending operations.',
    RULES,
    OPS_REFERENCE,
    `CURRENT BOARD:\n${describeBoard(input.diagram)}`,
    hist ? `CONVERSATION:\n${hist}` : '',
    `COACH REQUEST: ${input.message}`,
    input.retryNote ?? '',
  ].filter(Boolean).join('\n\n');
}

export function parseOpsReply(text: string): { reply: string; ops: unknown[] } | null {
  try {
    const cleaned = text.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    const a = cleaned.indexOf('{'), b = cleaned.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    const j = JSON.parse(cleaned.slice(a, b + 1));
    if (!j || typeof j !== 'object' || !Array.isArray(j.ops)) return null;
    return { reply: typeof j.reply === 'string' ? j.reply.trim().slice(0, 6000) : '', ops: j.ops };
  } catch {
    return null;
  }
}

export type OpsRun = { reply: string; applied: boolean; diagram: WebDiagramV1; attempts: number; opsApplied: number; error?: string };

export async function runBoardAiOps(input: {
  diagram: WebDiagramV1;
  message: string;
  history?: Chat[];
  call?: (prompt: string) => Promise<string>;
  model?: string;
  context?: { ageGroup?: string; gameModelId?: string };
}): Promise<OpsRun> {
  const history = input.history || [];
  const call =
    input.call ??
    (async (prompt: string) => {
      setMetricsContext({ operationType: 'board_ai_ops', ageGroup: input.context?.ageGroup, gameModelId: input.context?.gameModelId });
      try {
        return await generateText(prompt, { timeout: 90000, retries: 1, model: input.model ?? (process.env.GEMINI_BOARD_AI_MODEL || process.env.GEMINI_FAST_MODEL), maxOutputTokens: 8192, responseMimeType: 'application/json' });
      } finally {
        clearMetricsContext();
      }
    });
  const revision = revisionOf(input.diagram);
  let retryNote: string | undefined;
  let lastError = '';
  let reply = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    const parsed = parseOpsReply(await call(buildOpsPrompt({ diagram: input.diagram, message: input.message, history, retryNote })));
    if (!parsed) {
      lastError = 'The reply was not JSON of the form {"reply": "...", "ops": [...]}.';
      retryNote = `Your previous reply could not be read: ${lastError} Reply again with ONLY that JSON.`;
      continue;
    }
    reply = parsed.reply || reply;
    if (!parsed.ops.length) return { reply: reply || 'No change to the board.', applied: false, diagram: input.diagram, attempts: attempt, opsApplied: 0 };
    const out = applyBoardOps(input.diagram, { revision, ops: parsed.ops });
    if (out.ok) return { reply: reply || 'Updated the board.', applied: true, diagram: out.diagram, attempts: attempt, opsApplied: out.results.length };
    lastError = `operation ${out.error.index} (${out.error.code}): ${out.error.message}`;
    retryNote = `Your previous operations were REJECTED and none were applied: ${lastError}\nReply again with the complete corrected list of operations for the original request.`;
  }
  return { reply: `${reply ? reply + '\n\n' : ''}(I couldn't apply that change to the board — ${lastError} The board is unchanged.)`, applied: false, diagram: input.diagram, attempts: 2, opsApplied: 0, error: lastError };
}
