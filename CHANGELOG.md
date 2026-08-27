# Changelog

All notable changes to this project are documented here. The version id lives
in [`VERSION`](VERSION).

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
