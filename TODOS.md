# TODOS

Open / parked work. Mark completed with date + version when shipped.

## Open

### Boards — Phase H (cross-links)

- Vault → board and Coach Center → board deep links still parked.
- **Why deferred:** Editor A→G.5 shipped first; cross-links are additive.
- **Refs:** `docs/TACTICAL_BOARD_MOBILE_PLAN.md` (Phase H)

### Boards — AI image upload (F v2)

- Board AI is text-only on mobile.
- **Refs:** plan Phase F notes

### Coach Center — Phase F+ (calendar visual parity, denser game day)

- Week calendar is usable but not full web grid parity.
- Rich game-day showcase / modes stay web-only by design for now.
- **Refs:** `docs/COACH_CENTER_IMPLEMENTATION_PLAN.md`

### Generate parity gaps

- Topic lock, drill-type picker, coach-level regenerate, QA scores still web-leaning.
- **Refs:** `docs/GENERATE_PARITY_REPORT.md`

### Landing `codex/mobile-app` → `main`

- Branch is far ahead of `main`; merge needs GAME_MODEL / Render coordination.
- **Refs:** `docs/release-process.md`

## Completed

- **Native tactical board editor A→G.5** — **Completed:** v1.11.0 (2026-08-25)
- **Coach Center mobile A→E** — **Completed:** v1.11.0 (2026-08-25)
- **Docs hub + board/CC how-tos/tutorials** — **Completed:** v1.11.0 (2026-08-25)
- **Blank board `GAME_MODEL_REQUIRED` fallback** — **Completed:** API on main / mobile branch (2026-08)

## Game Model

### Extract a shared LLM JSON-response parser

**What:** The "strip markdown fences, then JSON.parse" pattern (`text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()` or a close variant) is duplicated identically across at least 19 existing files, plus the new `parseJsonResponse` in `generate-from-priority.ts` makes 20. Files include `services/session.ts`, `services/drill.ts`, `services/fixer.ts`, `services/player-plan.ts`, `services/board-ai-chat.ts`, `services/skill-focus.ts`, `services/diagram-enrichment.ts`, `services/description-enrichment.ts`, `services/session-progressive.ts`, `routes-video-analysis.ts`, `routes-admin.ts`, and several files under `scripts/`.

**Why:** A bug fix or edge-case improvement to the parsing logic (e.g. handling a model that wraps output in ` ```javascript ` instead of ` ```json `, or trailing commentary after the closing fence) currently requires 20 separate edits, and it's easy to miss one.

**Context:** Found during the eng review of the game-model translation layer (`codex/game-model-pilot`, 2026-08-27). Not introduced by that branch — pre-existing debt across the whole codebase. A shared `parseJsonFromLlm()` util (probably in a new `src/lib/` or alongside `gemini.ts`) would let all 20 call sites converge on one implementation, but retrofitting existing call sites is a real, separate piece of work — not something to bundle into an unrelated feature branch.

**Effort:** M
**Priority:** P3
**Depends on:** None
