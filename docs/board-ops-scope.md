# Board operations: the precise way to drive the board

Status 2026-10-14 (branch `codex/standard-coords`, local): engine built; AI wired behind BOARD_AI_OPS=1 (board-ai-ops.ts); live results below.

## Why
Measured against the live model (DSL mode), the AI is right on structure but misses on configuration: a whole
team missing in 2 of 16 runs, "both teams 4-3-3" giving the second team a 4-4-2, unknown formations silently
replaced, small-sided setups staying 11v11 in 7 of 8 runs. Each of those is the model returning a whole new
board that code then has to trust or repair. Tactics Journal's board takes the opposite approach (read from
their public client code): the AI sends a short list of small edits against the current board, validated
strictly, applied atomically, guarded by a revision number.

## What is built (`apps/api/src/services/board-ops.ts`, pure, 27 tests)
`applyBoardOps(diagram, { revision?, ops })` -> `{ ok, diagram, revision, results }` or
`{ ok: false, error: { index, code, message } }`.

- Players: `set_formation` (exact app template), `add_player`, `move_player`, `update_player`, `remove_player`
  (addressed by `{ team, number }` or `{ playerId }`).
- Ball: `set_ball` (coordinates, or at a carrier).
- Arrows: `add_arrow` (pass / run / press / cover / transition; ends are players or points), `update_arrow`,
  `remove_arrow`.
- Frames: `add_frame` (copies a frame so object ids stay stable), `update_frame`, `remove_frame`,
  `set_active_frame`. Every other op takes an optional `frame`.
- All-or-nothing: the first bad op aborts the batch and the board is returned untouched.
- Strict: unknown ops/fields, out-of-range coordinates (rejected, not clamped), duplicate shirts, missing players,
  unsupported formations. Errors carry a code and a message that names the valid choices, so the sender can fix
  itself (e.g. "No ATT 15 on this board. ATT numbers present: 1, 2, 3, ...").
- Revision: a short content hash; an edit sent with an older revision is rejected as stale.
- Bounds: 100 ops per batch, 12 frames.

## Live results (BOARD_AI_OPS=1, DSL mode otherwise on, 12 setups x 2 runs + 10 arrow prompts, default 11v11 start board)
- Known formations asked: 26/26 exactly the template (was 20/24); teams missing: 0 (was 2).
- Unknown formations (3-4-3, 5-3-2, 4-1-4-1): replaced by the closest supported one and the reply says so (3-4-3 -> 3-5-2,
  5-3-2 -> 3-5-2, 4-1-4-1 -> 4-2-3-1). One reply named 4-1-4-1 while the board used 4-2-3-1.
- Small-sided team sizes: 8/8 (was 1/8): 7v7, 9v9, 4v4 + 2 neutrals, 5v2.
- Arrows: passes between the right players 9/10 by the script (the "miss" is a shot to goal drawn as a pass to a point),
  ball with the first passer 10/10, frames 2-4 for multi-move prompts.
- NOT measured: scene prompts (press, block, zone) in this mode, where the model must choose positions itself.
- Trade-off: replies are 1-4 sentences; the older "What I saw / On the board / Coaching points" structure is not produced.
- Bypassed in this mode: symbolic DSL, combo builder, play-out placement, repair passes. Image / PDF import and the
  clarify gate still use the old path.

## Not built yet
1. Op additions: areas / labels; more formations (3-4-3, 5-3-2, 4-1-4-1 are not in the templates).
2. Evaluate scene prompts in ops mode and decide how phase placement (goal kick / pocket / final third) is reached from ops.
3. An HTTP route (`POST /api/boards/:id/ops`) and an undo entry per batch in the editor.

