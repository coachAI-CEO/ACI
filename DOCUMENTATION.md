# TacticalEdge / ACI — Documentation Hub

**Last updated:** 2026-08-25 · **Version:** see [`VERSION`](VERSION)

TacticalEdge (ACI) is an AI soccer coaching platform: generate drills and sessions, run Coach Center for club teams, edit tactical boards, analyze video, and export PDFs. Clients are **web** (Next.js), **mobile** (Expo), and a shared **Express API**.

This file is the **map**. Deep reference lives under `docs/`. Historical API/schema dumps from Feb 2026 are in git history for this path; do not treat archived copies as current.

---

## Monorepo

```
aci/
├── apps/
│   ├── api/          Express + Prisma + AI generation
│   ├── web/          Next.js coach web app
│   └── mobile/       Expo (iOS / Android)
├── packages/
│   └── shared/       @aci/shared — types, board libs, Coach Center shapes
├── docs/             Plans, inventories, how-tos, release process
├── DOCUMENTATION.md  ← you are here
├── VERSION
├── CHANGELOG.md
└── TODOS.md
```

| Surface | Default URL / port | Start |
|---|---|---|
| API | `http://localhost:4000` | `pnpm --filter api dev` (see app README) |
| Web | `http://localhost:3000` | from `apps/web` |
| Mobile | Expo Metro | `cd apps/mobile && npx expo start` |
| Staging API | `https://tacticaledge-api.onrender.com` | Render (`docs/release-process.md`) |

---

## Quick start (mobile against staging)

1. Work on branch `codex/mobile-app` (often worktree `aci-mobile-dev`).
2. Create `apps/mobile/.env`:

```env
EXPO_PUBLIC_API_URL=https://tacticaledge-api.onrender.com
EXPO_PUBLIC_WEB_URL=https://tacticaledge.app
```

3. Restart Metro with cache clear after any `.env` change: `npx expo start --clear`.
4. Without `.env`, the client falls back to `http://localhost:4000` and looks like the API is down.

Full mobile plan: [`docs/mobile/README.md`](docs/mobile/README.md).

---

## Docs by job (Diataxis)

### Tutorials (learn by doing)

| Doc | Audience |
|---|---|
| [`docs/mobile/TUTORIAL_FIRST_BOARD.md`](docs/mobile/TUTORIAL_FIRST_BOARD.md) | First native board: create → draw → save |
| [`docs/mobile/TUTORIAL_COACH_CENTER_WEEK.md`](docs/mobile/TUTORIAL_COACH_CENTER_WEEK.md) | This week's curriculum → build session |

### How-to (task recipes)

| Doc | Task |
|---|---|
| [`docs/mobile/HOW_TO_TACTICAL_BOARDS.md`](docs/mobile/HOW_TO_TACTICAL_BOARDS.md) | Edit, sequence, AI chat, share, fork, offline |
| [`docs/mobile/HOW_TO_COACH_CENTER.md`](docs/mobile/HOW_TO_COACH_CENTER.md) | Team overview, curriculum, chat, game day recap |
| [`docs/release-process.md`](docs/release-process.md) | Render branch flip, pilot coaches, Expo `.env` |
| [`docs/mobile/TESTING.md`](docs/mobile/TESTING.md) | Mobile test approach |

### Reference

| Doc | What it defines |
|---|---|
| [`docs/mobile/README.md`](docs/mobile/README.md) | Expo architecture, handoff table, env |
| [`docs/TACTICAL_BOARD_TYPES.md`](docs/TACTICAL_BOARD_TYPES.md) | Canonical `WebDiagramV1` in `@aci/shared` |
| [`docs/TACTICAL_BOARD_MOBILE_INVENTORY.md`](docs/TACTICAL_BOARD_MOBILE_INVENTORY.md) | Mobile/web/API board surfaces |
| [`docs/COACH_CENTER_MOBILE_INVENTORY.md`](docs/COACH_CENTER_MOBILE_INVENTORY.md) | Coach Center routes + API usage |
| [`docs/CALENDAR_BACKEND_API.md`](docs/CALENDAR_BACKEND_API.md) | Calendar API |
| [`docs/CALENDAR_MOBILE_INVENTORY.md`](docs/CALENDAR_MOBILE_INVENTORY.md) | Calendar mobile surfaces |
| [`docs/GENERATE_PARITY_REPORT.md`](docs/GENERATE_PARITY_REPORT.md) | Generate web ↔ mobile gaps |

### Explanation / plans

| Doc | Why it exists |
|---|---|
| [`docs/TACTICAL_BOARD_MOBILE_PLAN.md`](docs/TACTICAL_BOARD_MOBILE_PLAN.md) | Boards A→G.5 shipped; H parked |
| [`docs/COACH_CENTER_IMPLEMENTATION_PLAN.md`](docs/COACH_CENTER_IMPLEMENTATION_PLAN.md) | Coach Center A→E shipped; F+ open |
| [`docs/CALENDAR_IMPLEMENTATION_PLAN.md`](docs/CALENDAR_IMPLEMENTATION_PLAN.md) | Calendar rollout plan |
| [`docs/tactical-board-phase-positioning.md`](docs/tactical-board-phase-positioning.md) | Pitch phase/zone positioning |
| [`docs/tactical-board/`](docs/tactical-board/) | Formation principles |

### Project hygiene

| File | Role |
|---|---|
| [`VERSION`](VERSION) | Current release id |
| [`CHANGELOG.md`](CHANGELOG.md) | User-facing changes |
| [`TODOS.md`](TODOS.md) | Deferred / parked work |

---

## Feature snapshot (2026-08)

| Area | Web | Mobile |
|---|---|---|
| Generate (session / drill / series) | Full | Core flows; see parity report for gaps |
| Vault + favorites | Full | Browse + detail + favorites |
| Calendar | Full | Read surfaces shipped |
| Coach Center | Author + consume | Consume A→E (curriculum, next sessions, chat, game day) |
| Tactical boards | Full editor | Native editor A→G.5 (create, tools, sequence, AI text, share) |
| Video analysis | Upload/results | Camera-native path |
| Player plans / PDF | Full | Create + native share |
| Billing / admin / Doc Hub | Web | Handoff via `webPath()` |

---

## Shared packages

`@aci/shared` (`packages/shared`) owns wire types used by web, API, and mobile:

- Sessions / drills / enums
- `WebDiagramV1` + board helpers (`pitch-formats`, elements, lines, sequence, …)
- Coach Center team / curriculum / chat shapes
- Calendar event envelopes

Add fields in shared first, then API Zod (boards) or serializers, then clients. See [`docs/TACTICAL_BOARD_TYPES.md`](docs/TACTICAL_BOARD_TYPES.md).

---

## Branches & worktrees

| Branch | Typical use |
|---|---|
| `main` | Production / default |
| `codex/mobile-app` | Mobile + shared board/Coach Center work |
| `codex/web-prod-release` | Web release train |

Mobile source of truth for day-to-day Expo work is often the `aci-mobile-dev` worktree on `codex/mobile-app`. Other worktrees on `main` may lack `apps/mobile` after hotfixes — check before editing.

Render staging branch pin: [`docs/release-process.md`](docs/release-process.md).

---

## Contributing docs

1. Prefer updating the **smallest** correct doc (inventory / how-to / plan) over growing this hub.
2. After a ship that changes user-visible behavior, run `/document-release` (or update CHANGELOG + inventories by hand).
3. Parked work goes in [`TODOS.md`](TODOS.md), not buried in plans only.
