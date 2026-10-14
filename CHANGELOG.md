# Changelog

All notable changes to this project are documented here. The version id lives
in [`VERSION`](VERSION).

## 1.14.1 — 2026-10-13

- Fix: compiled API crashed at startup on Render (`ERR_MODULE_NOT_FOUND` for `@aci/shared`).
  `link-shared-runtime.mjs` now rewrites compiled `require("@aci/shared")` calls to a relative path.
- `render.yaml` now matches the live service: branch `main`, build runs the link step last, direct `node` start.

## 1.14.0 — 2026-10-13

### Tactical board — sequences, export, shared package, relative press

- Board editor: multi-frame sequences (up to 12), object ids, PNG/GIF export,
  stamps, snap/duplicate/flip/nudge/group operations
- `@aci/shared` (`packages/shared`) is the canonical board code; the API's
  `board-phase-placement` / `board-press-relative` / formation principles are the
  single source for the placement chassis, synced into `apps/web/src/lib/chassis/`
  (`pnpm sync:board-chassis`, enforced by `board-chassis-sync.test.ts`)
- Fix: DEF goal-kick press no longer sends right-sided players to the opposite flank
- Opt-in `BOARD_PRESS_RELATIVE=1` relative-offset press for the DEF goal-kick phase
- Build: `link-shared-runtime.mjs` post-build step so the compiled API can load
  `@aci/shared` at runtime (fixes the `ERR_MODULE_NOT_FOUND` startup crash)
- Fix: `too_short` SVG check now judges model output before static chrome is injected
- Board diagram max payload raised to 256 KB; AI chat frame cap 8 → 12

## 1.13.0 — 2026-08-28

### Diagrams — scene path on WebDiagramV1 + first-class ball

The scene-XY diagram path now generates and stores a `WebDiagramV1` document
(strict zod schema: `players` with `ATT`/`DEF` team + role codes, `balls[]`,
ordered `playerId` arrows). `WebDiagramV1` is the wire + storage format;
`DrawerParams` stays the internal render format. `ModelScene` is removed.

- Every diagram now draws exactly one ball; the first ordered arrow starts at it
- `scene-kit.ts` (new): deterministic reconciliation for the scene path —
  two-team scoring, verbatim role-label preservation, roster line/side
  assignment, keeper-per-goal, defensive-target gate, and the L/R touchline
  mirror for the defending team (right-side roles to the top of screen)
- `promptForScene` rewritten to request the `WebDiagramV1` JSON subset;
  `SCENE_PROMPT_VERSION` → `scene-webv1-v1`
- Scene card builder: sub-squad detection, roster extraction with a sanity
  gate, formation-line reconciliation against implied counts
- `scripts/scene-thesis` sampler: stratified run through the real two-call
  pipeline with frozen checks + optional visual judge, including a ball check

### Repo

- Shipped from a fresh branch off `main`; `codex/diagram-scene-thesis` work
  (already merged) is superseded by this consolidated PR

## 1.12.0 — 2026-08-27

### Mobile — tactical board editor parity

The phone editor now matches the web editor's core drawing surface.

- Device-driven pitch orientation: portrait → vertical pitch, landscape →
  horizontal pitch with an edge-to-edge board and a slim overlaid HUD
- Formation + Setup sheets: pick a shape per team, place attacking/defending/
  transition phases by zone and channel (via `POST /boards/:id/phase-place`)
- Arrow / shape / kit type pickers, label create + edit, board rename
- Board list: Favorites and Forked filter chips
- Board AI chat accepts a photo attachment (mirrors the web editor)
- Shared `@aci/shared` board modules: `formations`, `labels`, `setup-phase`;
  web `board-formations.ts` now re-exports from shared
- App allows rotation; only the board screens opt into landscape, every other
  screen stays portrait-locked

### Repo

- `codex/mobile-app` merged up to `main` — reconciled against the structured
  game model (Principle / Subprinciple / TrainingPriority) and its Prisma schema

## 1.11.0 — 2026-08-25

### Mobile — tactical boards

You can create, edit, sequence, and share tactical boards on phone without
opening the web editor first.

- Native editor (Move / Player / Arrow / Ball / Erase) with Undo/Redo and Save
- Multi-frame timeline + playback
- Text AI chat for board edits
- Fork from session or drill; blank create with game-model fallback
- Offline read cache for your own boards; feature flag `tacticalBoardV1`
- How-to: [`docs/mobile/HOW_TO_TACTICAL_BOARDS.md`](docs/mobile/HOW_TO_TACTICAL_BOARDS.md)
- Tutorial: [`docs/mobile/TUTORIAL_FIRST_BOARD.md`](docs/mobile/TUTORIAL_FIRST_BOARD.md)

### Mobile — Coach Center

You can run the week-of workflow on device: curriculum, next sessions, season
chat, game-day recap.

- Shared Coach Center types in `@aci/shared`
- Team overview, curriculum week picker, next sessions, season chat
- How-to: [`docs/mobile/HOW_TO_COACH_CENTER.md`](docs/mobile/HOW_TO_COACH_CENTER.md)
- Tutorial: [`docs/mobile/TUTORIAL_COACH_CENTER_WEEK.md`](docs/mobile/TUTORIAL_COACH_CENTER_WEEK.md)

### Documentation

- [`DOCUMENTATION.md`](DOCUMENTATION.md) rebuilt as the current docs hub
- Coach Center plan + inventory checked into `docs/`
- [`VERSION`](VERSION), this changelog, and [`TODOS.md`](TODOS.md) introduced

### For contributors

- Active mobile branch: `codex/mobile-app` (often worktree `aci-mobile-dev`)
- Expo must set `EXPO_PUBLIC_API_URL` or Metro defaults to localhost
- Staging / Render notes: [`docs/release-process.md`](docs/release-process.md)
