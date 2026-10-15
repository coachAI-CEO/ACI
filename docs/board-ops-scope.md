# Board operations: the precise way to drive the board

Status 2026-10-14 (branch `codex/standard-coords`, local): engine built and tested; AI wiring NOT done.

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

## Not built yet
1. AI wiring (behind a flag): the model emits `{ reply, ops }` instead of a diagram / DSL; the server applies it to
   the current board; on an error the message goes back to the model for one retry. Prompt change + live evaluation.
2. Op additions: areas / labels, a `set_team_size` macro for small-sided setups (the 4v4 + 2 neutrals case), more
   formations (3-4-3, 5-3-2, 4-1-4-1 are not in the templates).
3. An HTTP route (`POST /api/boards/:id/ops`) and an undo entry per batch in the editor.
4. Re-run the same live configuration prompts and compare against the 20/24 (known formations) and 1/8
   (small-sided) baselines.
