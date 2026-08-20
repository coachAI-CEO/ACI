# Gemini addendum — accepted architecture (second pass)

Source: Gemini’s reply to `GSTACK_TACTICAL_BOARD_REPLY.md`.  
Status: **direction accepted**. Not an implementation spec yet — vocabulary, Zod DSL, and `solveBoardLayout` are still missing.

---

## Gemini’s answer (cleaned)

Refine the architecture around **AI spatial reasoning**, not stack churn. Do not replace Express with FastAPI, do not add a Python runtime for geometry, do not bundle WebSocket multiplayer.

**Agreed keep:** Express 5, Next.js 16, React 19 SVG, Gemini, Zod.

**Agreed non-goals:** FastAPI, Shapely, kloppy, Socket.IO.

**Core takeaway:** Zod guarantees *structural* validity (`x`/`y` are numbers 0–100). It cannot prevent four shirts on `(50,50)`, arrows to empty space, or cones off the rondo. If Gemini emits absolute coordinates, hallucinations persist on any backend.

**Implementation in the existing stack:**

```
User chat
  → Express board-ai-chat.ts
  → Gemini structured output (responseSchema)
  → Symbolic DSL (grid rules, relative roles, action ids)
  → TypeScript solveBoardLayout(dsl)  →  WebDiagramV1 0–100
  → TacticalBoardEditor.tsx
```

1. Change Gemini output from `[x,y]` to symbolic directives: grid intent (`rondo_square`, `half_pitch_attack`, `penalty_box_drill`), relative placement (`grid_corner_north_west`, `center_defending`, `perimeter_attacker`), actions (`pass(from: P1, to: P2)`).
2. Pass the schema into Gemini `responseSchema` (constrained decoding), not freeform JSON + post-hoc parse.
3. Pure TS helper `solveBoardLayout(dslPayload)`: meters/grid → 0–100 boxes, token → `(x,y)`, overlap push, B-spline movement curves.

**Checklist:** keep stack → update `board-ai-chat.ts` to DSL → add TS solver before the editor.

---

## Engineering read (ours)

### Accept as locked

| Claim | Decision |
|---|---|
| Gap is DSL vs coordinate JSON, not Express vs FastAPI | Locked |
| Keep Express / Next / React SVG / Gemini / Zod | Locked |
| Solver is TypeScript, server-side in the apply path | Locked — run in `board-ai-chat.ts` *before* the editor so apply is correct even if the client never re-solves |
| Gemini `responseSchema` instead of freeform JSON | Locked as the schema enforcement upgrade |
| Unstack stays in the solver, not in the model | Locked — we already have `separateOverlappingPlayers`; fold it into `solveBoardLayout` |

### Adjust before building

| Gemini said | We will do instead |
|---|---|
| Overlap push if within **3 units** | Keep **8 units**. Shirt diameter is ~3% of pitch length; 3 units still hides a number (red 9 / blue 6). |
| Solver “server-side helper **or** client-side utility” | **Server first** (AI apply). Client can call the same helper on drop/load so manual edits cannot restack. |
| B-spline movement curves | Keep current quadratic `control` + polyline `path` until a solver *needs* a spline lib. Do not add a dependency for this. |
| “Zod / responseSchema” as one thing | Zod stays our runtime type. Gemini wants a **JSON Schema** `responseSchema` (see `@google/generative-ai` `generationConfig`). Derive JSON Schema from the Zod DSL; do not pass Zod objects to Gemini. Video analysis already uses `responseMimeType: application/json` without a board DSL schema. |
| Examples `P1` / `D1` | Keep existing ids **`att-9` / `def-6`**. Do not invent a second identity system. |

### Still missing (Gemini did not deliver these)

We asked for A–E. This reply delivered the **pipeline sketch**, not the artifacts:

| Ask | Status |
|---|---|
| A. Primary OSS layout tool (d3-force vs Kiwi vs neither) | **Unanswered.** Default: **neither for v1** — extend our repulsion + formation/phase maps. Revisit d3-force only if clusters still collapse. |
| B. Contract A JSON Schema with **no x/y** | **Unanswered.** Only three example tokens. Need a closed enum for grid intent, relative_position, equipment placement. |
| C. `state_delta` for follow-ups | **Unanswered.** First slice can still return a full DSL; solver emits full `WebDiagramV1`. Deltas are slice 2. |
| D. Explicit non-goals | **Answered.** FastAPI / Shapely / kloppy / Socket.IO / tldraw / Fabric are out. |
| E. OSS table | **Answered by omission.** No new libraries required for v1. |

Also still unspecified, and we will not let the solver invent them:

- Import review Q1–Q3 (file in → questions → then DSL → solve)
- Us = ATT blue, own goal RIGHT (solver constraint, not a Gemini guess)
- Freeze-shirts (DSL actions only; solver copies current x/y)
- Sequence frames (DSL per beat, or later deltas)
- Equipment: `mini-goal` / `cone` / `mannequin` / `pole` + placement tokens
- 7v7 / 9v9 / 11v11 and pitch thirds

---

## v1 build order (when we implement)

Do not start a Python sidecar. Do not add d3-force/Kiwi/tldraw until v1 of the DSL is in production.

1. **Zod `BoardSymbolicDsl`** — `activity`, `grid`, `entities[]` (id, team, role, `relative_position`), `equipment[]` (kind, placement, qty), `actions[]` (`from_id`, `to_id`, type). **No x/y.**
2. **`solveBoardLayout(dsl, currentDiagram, pitchFormat)`** in `apps/api` (shared types with web later). Output existing `WebDiagramV1`. Reuse formations, thirds, unstack (gap 8), us/them orientation.
3. **`board-ai-chat.ts`** — Gemini `responseMimeType: application/json` + `responseSchema` from the Zod DSL. Prompt: emit DSL only. Apply path: `parseDsl` → `solveBoardLayout` → existing sequence/label repairs as needed.
4. **Editor** — keep rendering `WebDiagramV1`. Optionally run unstack on load/drop (already started).
5. **Later** — `state_delta`, Gemini import as “what I saw” then DSL, d3-force only if unstack is insufficient.

### Closed token list we will author (not wait for Gemini)

Until a better enum arrives, v1 tokens should be finite and mapped in code:

- **Grid:** `full_pitch`, `half_att`, `half_def`, `third_left`, `third_middle`, `third_right`, `box_att`, `box_def`, `rondo`, `ssg_grid`
- **Placement:** `own_gk`, `own_line`, `own_6`, `own_8`, `own_winger_right`, `own_winger_left`, `own_9`, `opp_*` mirrors, `grid_nw`, `grid_n`, `grid_ne`, `grid_w`, `grid_c`, `grid_e`, `grid_sw`, `grid_s`, `grid_se`, `perimeter`, `inside`
- **Actions:** existing arrow types `pass` `run` `press` `cover` `transition` via `from_id`/`to_id`

---

## Implementation plan (v1)

**Do we need eng to pitch in?** Not to write it. One person can land v1 behind a flag. Eng/coach should **review twice** (token list before coding the maps; live boards before flipping the flag). No Python, no canvas rewrite, no new hire skillset.

### What we will not do in v1

- Dual-write a second canvas store. Solver output is existing `WebDiagramV1`.
- `state_delta`, d3-force, Kiwi, B-splines, kloppy, WebSockets.
- Change import-review (Q1–Q3) or freeze-shirts on day one — those stay on the **legacy coordinate path** until the DSL covers them.
- Ask Gemini for x/y *and* symbols in the same object (that re-opens hallucination).

### Flag

`BOARD_AI_SYMBOLIC_DSL=1` (off by default). When off, current `diagram: WebDiagramV1` path is unchanged. When on, apply requires `dsl` and ignores model x/y.

### Slice 1 — schema + solver, no Gemini yet (safest)

Pure functions + fixtures. Editor and chat untouched.

| File | Job |
|---|---|
| `apps/api/src/services/board-symbolic-dsl.ts` | Zod `BoardSymbolicDsl` (no x/y). Closed enums for grid / placement / action type. |
| `apps/api/src/services/board-layout-solver.ts` | `solveBoardLayout(dsl, current, format) → WebDiagramV1` |
| fixtures | rondo 4v1, 11v11 4-3-3 vs 4-2-3-1, box drill with mini-goals |

Solver internals (reuse, don’t reinvent):

1. Resolve **grid** → area box in 0–100 (thirds / half / box / rondo already have bands in `board-ai-chat.ts`).
2. Seed shirts from **formation chassis** (`build11v11FormationPlayers` / web `board-formations`) using `entities[].role` + number.
3. Nudge each entity by **relative_position** inside the grid (not free x/y).
4. Place **equipment** from kind + placement + qty.
5. Build **arrows** from `from_id`/`to_id` only (existing playerId refs).
6. **Unstack** gap 8; lock ATT own goal RIGHT / DEF LEFT.
7. Validate with existing `parseWebDiagramV1`.

Done when: given a hand-written DSL fixture, the solver emits a legal diagram with no two shirts closer than 8, GKs on the correct ends, and arrows attached to ids.

### Slice 2 — wire chat behind the flag

In `runBoardAiChat`, when the flag is on **and** the turn is a normal apply (not import-review, not freeze):

- Prompt + `responseMimeType: application/json` + `responseSchema` derived from the Zod DSL (Gemini JSON Schema subset — no `additionalProperties` tricks).
- Parse `dsl` with Zod. On failure: do not apply (same as today’s invalid diagram).
- `solveBoardLayout` → existing `repairBoardDiagramLabels` / sequence helpers that **don’t move shirts** if we can avoid it.
- Reply format unchanged (What I saw / On the board / Coaching points).

Fallback: if Gemini returns old `diagram` with x/y and no `dsl`, **do not apply** while the flag is on (fail closed). Log and tell the coach to retry. Do not silently mix paths.

### Slice 3 — QA then default-on

Five live prompts on `codex/board-next` web:3001 / api:4001:

1. “4v4 rondo in the middle third, mini-goals on the ends”
2. “11v11 4-3-3 vs 4-2-3-1, us playing out from the right”
3. “Back 3 protecting a mini-goal, our defensive third”
4. Drag a player onto another shirt — still unstack
5. Numbered reading 1/2/3 then “just draw it”

Then default the flag on for board chat. Import + freeze stay legacy until slice 4.

### Slice 4 — later (not this plan)

Import → review questions → DSL → solve. Freeze = actions-only DSL. Sequence = `dsl.frames[]`. Optional d3-force if unstack still loses clusters.

### Eng / coach checkpoints (the only pitch-in)

| When | Who | Question | If skipped |
|---|---|---|---|
| Before slice 1 maps | Coach or whoever owns board language | Are the closed tokens (grid / placement) how we talk on this board? | We ship the enum in the addendum and adjust after first QA |
| After slice 2 on staging | Anyone who uses the board daily | Do 5 prompts above look like coaching, not a rondo-in-the-corner bug? | Do not flip the flag |
| Gemini `responseSchema` flake | Eng who has hit Gemini JSON Schema limits | If constrained decoding rejects the schema, drop to JSON mime + Zod only | Still no x/y from the model |

No checkpoint needed for: Express vs FastAPI, tldraw, Fabric, Socket.IO, kloppy.

### Effort

Slice 1–2 is the real work (schema + maps + chat wire). Slice 3 is a session of clicking. Editor stays as-is. One implementer; two short reviews.
