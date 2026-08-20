# Reply to Gemini — Tactical Board Research Review

This is a reply from the product engineering team that already ships the tactical board. We compared your **Decoupled Spatial Architecture** spec and **Recommended Technology Stack** against the running system (TypeScript monorepo: Next.js React SVG editor + Express API + Gemini + Zod + Prisma/Postgres).

Please treat this as ground truth for a second pass. Your spec diagnosed the right failure mode (LLM math). Several stack recommendations do not fit this codebase. We want you to **re-recommend open-source tools that drop into TypeScript**, not a Python rewrite.

---

## 1. Corrections to your “current framework” picture

You described us as generating raw pixels/SVG paths, losing entity identities, and doing unidirectional chat-to-image.

That is too primitive. What we actually run:

| You assumed | What we have |
|---|---|
| LLM emits pixels / SVG paths | LLM emits `WebDiagramV1` JSON with **0–100 pitch %** (`x`,`y`) |
| Static unconstrained redraw | Interactive **custom React SVG** editor (drag, kit, arrows, filmstrip) |
| Lost entity identities | Stable ids (`att-9`, `def-6`), playerId-linked arrows, tween-by-id |
| No schema | **Zod** `parseWebDiagramV1` after generation; invalid diagrams are not applied |
| Unidirectional | Manual edits persist; the **full compact diagram** is resent every chat turn |

We are still **Direct LLM Generation** — that part of your diagnosis is correct. We are a more mature variant of it, not a blank canvas.

**Do not recommend replacing the canvas.** Layer 3 (React + SVG + Tailwind) already matches your stack table. We do not use Fabric.js and do not need it.

---

## 2. Our shortcomings (honest)

These are the gaps that still hurt coaches. Ranked by product pain, not architectural purity.

### S1 — LLM still paints coordinates
The model is required to return a **full diagram with absolute `x`/`y`**, not a symbolic DSL. Prompt even says “return a FULL diagram every time (not a patch).”

Effects: orientation mistakes (GK on a touchline), shirts stacked on the same spot, press lines that ignore pitch thirds, verbose payloads (~2k+ tokens of coordinates vs your &lt;300 token DSL target).

`relativePosition` exists on the type and is **unused / stripped** on compact. There is no `activity_type`, no meter grid, no `placement`+`quantity` equipment DSL.

### S2 — No real layout solver
After the model paints, we run **heuristics**: formation templates, phase chassis, opposition-near-play, a 10-pass player unstack (min gap ~8%). That reduced overlap (e.g. red 9 on blue 6) but it is not a constraint solver. It cannot map `grid_corner_north` → 105×68 m, and it can still restack after a later repair pass.

### S3 — Follow-ups are full redraws, not deltas
Canvas → JSON → next prompt is live. We do **not** send `state_delta`. Every apply can rewrite the whole picture. Sequence frames are **full snapshots**, not temporal deltas. Identity is prompt-enforced, not a state machine.

### S4 — Pitch is percent, not meters
Canonical space is 0–100 with `y` = goal-to-goal (0 = DEF/left, 100 = ATT/right). Formats 7v7 / 9v9 / 11v11. No `pitch_dimensions` in meters. Equipment is per-instance `x`/`y`, not symbolic placement.

### S5 — Schema is post-hoc, not tool-calling
Gemini emits freeform JSON. Zod validates afterward. We do not use Gemini `responseSchema` / function calling, nor OpenAI/Anthropic tools. Failed validation leaves the board unchanged — safe, but the model still has to invent geometry.

### S6 — Product bugs your spec named, still live in the wild
Even with unstack + orientation repairs:

- Function/SSG imports can still draw portrait (GK on the top touchline) until remap fires.
- 11v11 default 4-3-3 vs 4-2-3-1 places away #9 on home #6 near the centre; unstack now separates them, but the formation depths still collide.
- Import path (PDF/image) needs Q1–Q3 before draw — your spec has **no import contract**.

### S7 — Not in the product (only shortcomings if you treat them as requirements)
- **kloppy / tracking ingest** — we do not ingest StatsBomb/Wyscout/GPS. This is a coaching board, not a match-data pipeline.
- **WebSockets / Socket.IO** — share is `PRIVATE` | `CLUB` via HTTP save, not simultaneous multiplayer.
- **Python FastAPI + Shapely + NumPy** — spatial math is TypeScript. A language rewrite would not fix S1–S6.

---

## 3. Open-source tools you already recommended — mapped to shortcomings

Please confirm or replace these. We will only adopt tools that run in **Node/TypeScript** next to Express, unless you can justify a sidecar.

| Shortcoming | Tool you named | License / role | Our verdict |
|---|---|---|---|
| S1 Symbolic DSL | *(none — you specified a JSON schema, not a library)* | Contract A | Need a **schema + prompt**, not a package. Ask: should we use Gemini structured output / JSON Schema, or a small TS DSL parser? |
| S2 Collision / layout | **[d3-force](https://github.com/d3/d3-force)** | BSD-3. Force simulation; you named it for overlapping icons and routing. | **Strongest TS fit.** We already unstack with pairwise repulsion; d3-force is the OSS upgrade. Confirm: player collision only, or also arrow routing? |
| S2 Constraints | **[Kiwi.js](https://github.com/IjzerenHein/kiwi.js)** (Cassowary) | MIT. Linear constraints (`#6 left-of #8`, `GK on goal line`). | **Plausible TS fit** for relative_position → coords. Heavier than d3-force. Tell us when Kiwi beats d3-force for soccer grids. |
| S2 Geometry in meters | **[Shapely](https://github.com/shapely/shapely)** | BSD. Python GEOS. | **Reject as primary.** Python-only. If meters matter, name a **TS** analogue (Turf.js? own affine map 105×68 → 0–100?). |
| S3 Canvas node graph | **[tldraw](https://github.com/tldraw/tldraw)** | Custom (source-available; check license for commercial). | **Do not replace the editor.** We already have React SVG. tldraw would rewrite Layer 3 for little gain. |
| S3 Scene graph | **[Fabric.js](https://github.com/fabricjs/fabric.js)** | MIT. | **Skip.** Spec already allows React SVG; that is what we ship. |
| S4 Tracking coords | **[kloppy](https://github.com/PySport/kloppy)** | MIT. Python. Standardizes event/tracking pitches. | **Out of scope** until we ingest match files. Not a board-layout tool. |
| S5 Strict JSON | **Pydantic** + OpenAI/Claude function calling | Apache / vendor APIs. | **Wrong ecosystem.** Our analogue is **Zod** (already in API). Ask for Gemini structured output patterns, not a Python rewrite. |
| S7 Live collab | **[Socket.IO](https://github.com/socketio/socket.io)** | MIT. | **Not a current requirement.** Club share is enough. Revisit if multiplayer is scoped. |
| Backend rewrite | **FastAPI** + NumPy/Pandas | OSS, Python. | **Reject.** Express + Prisma already serve the product. |

### Tools you did **not** name that we want you to evaluate

For each, say adopt / ignore / later, with a one-line why:

1. **Gemini `responseSchema` / function calling** — lock Contract A without leaving Google.
2. **JSON Patch (RFC 6902)** or a tiny `state_delta` schema — follow-up turns without full redraw.
3. **Turf.js** or a 20-line affine map — meters ↔ 0–100 without Shapely.
4. **elkjs / dagre** — only if you still want constraint layout and Kiwi is overkill.
5. **Open-source soccer diagram DSLs** (if you know any: TacticBoard, Playbook-style schemas, StatsBomb 105×68 convention) — reuse vs invent Contract A.
6. **B-spline / path helpers** (you mentioned B-spline movement curves). We have quadratic `control` + polyline `path`. Do we need a library?

---

## 4. What we will keep (do not design these away)

If your next spec drops these, it will be a regression:

- Import review first (Q1 pictures / Q2 who is us / Q3 how to draw); no guessing from a PDF.
- On this board **us = ATT (blue), own goal RIGHT**; them = DEF (red), own goal LEFT.
- Formation chassis (4-3-3, 4-2-3-1, …) and play-out sequences.
- Freeze-shirts (“don’t move players, only arrows”).
- Coach/player language locks (USSF density).
- Practice kit: mini-goal, cone, mannequin, pole.
- Session bridge into the existing session builder.
- 7v7 / 9v9 / 11v11 and pitch thirds.

A layout solver must **encode** these as constraints, not rediscover them.

---

## 5. What we want back from you

A short addendum, not a new stack table. Please answer in this structure:

**A. Revised Layer 2 for TypeScript**  
Pick one primary OSS layout tool (d3-force vs Kiwi.js vs neither) and describe the input tokens (`relative_position` vocabulary) you would actually emit.

**B. Contract A that Gemini can emit today**  
JSON Schema we can pass as `responseSchema`. No `x`/`y` on entities. Equipment as type+placement+qty. Actions as `from_id`/`to_id` only.

**C. Delta contract**  
Minimal `state_delta` for follow-ups so we stop sending 2k coordinate tokens. OSS or just a schema is fine.

**D. Explicit non-goals**  
Confirm FastAPI, Shapely, kloppy, tldraw, Fabric, and Socket.IO are **not** required to fix S1–S6.

**E. Open-source list**  
Table: shortcoming → recommended OSS repo → language → why it fits **this** TypeScript board.

We agree with the architecture: **LLM = intent parser, geometry = deterministic code.** We do not agree that the path there is Python, kloppy, or a new canvas. Recommend tools we can land next to the editor we already have.
