# TacticalEdge — Engineering Documentation

**Last updated:** 27 August 2026  
**Brand:** TacticalEdge (repo and some logs still say ACI)

Marketing and decks: [`TACTICALEDGE_UI_PRODUCT_REPORT.md`](./TACTICALEDGE_UI_PRODUCT_REPORT.md).  
Local run: [`RUN_SERVERS.md`](./RUN_SERVERS.md).  
Skill routing: [`CLAUDE.md`](./CLAUDE.md).

This file is the engineering map of what is in the repo now. It is not a January changelog.

---

## Overview

TacticalEdge is a soccer coaching OS. Coaches run a season from **Coach Center**, generate drills and sessions with tactical diagrams, teach on **Tactical Board**, and export session PDFs. Directors of Coaching author the club game model (principles, subprinciples, age-group defaults), assign a weekly training priority to each team, and track coach adherence from the **DOC Console**. A React Native app (`apps/mobile`, Expo) mirrors the board editor and Coach Center; it is in active development, not yet a store release.

**Stack**

- API: Node.js, Express 5, TypeScript, Prisma, PostgreSQL (Supabase in current deploys)
- Web: Next.js 16 App Router, React 19, Tailwind CSS 4
- AI: Google Gemini
- Hosting: web on Vercel (`tacticaledge.app`), API on Render
- Package manager: pnpm workspaces

**Defaults:** API `http://localhost:4000` (`PORT` or 4000). Web `http://localhost:3000` (Next may bump the port if 3000 is taken).

---

## Architecture

```
aci-features/
├── apps/api/          Express API (generation, vault, Coach Center, DOC Hub, game model, boards, PDFs)
├── apps/web/          Next.js app (marketing + authenticated product)
├── apps/mobile/       Expo / React Native app (board editor + Coach Center; in development)
├── packages/shared/   @aci/shared — board libs (WebDiagramV1, formations, setup phases)
├── docs/              Board design contract, mobile plan + inventories, game-model template
├── pitch-deck-*.html  Audience decks (source of truth is the product report)
└── CLAUDE.md          Agent routing
```

Data flow: browser → Next.js (`/api/*` proxies) → Express → Gemini / Prisma → PostgreSQL.

Mounted API routers (`apps/api/src/app.ts`): auth, drills, sessions, vault, favorites, calendar, billing, video analysis, DOC Hub, game model (principles / training priorities / adherence / age-group defaults), Coach Center, boards, diagram SVG, admin, player plans, skill focus.

---

## Product surfaces (what to open)

| Area | Web route | Notes |
|---|---|---|
| Landing / pricing | `/`, `/landing`, `/pricing` | Production signup is paused unless `TRIALS_ENABLED=true` (API) and `NEXT_PUBLIC_TRIALS_ENABLED=true` (web) |
| Coach Center | `/coach-center` | Team, 16-week curriculum, calendar, chat, next sessions, game day + recap |
| Session Builder | `/demo/session` | 60/90 min sessions; full PDF + Coach’s Sheet |
| Drill Generator | `/demo/drill` | Single drill + diagram |
| Vault / favorites | `/vault`, `/vault/favorites` | Club-scoped for club members. Codes D-XXXX, S-XXXX, SR-XXXX |
| Calendar | `/calendar` | Personal schedule |
| Tactical Board | `/boards`, `/board/[id]` | Flag `tacticalBoardV1` (on by default) |
| Video analysis | `/video-analysis` | Beta |
| DOC Console | `/doc-hub` | DOC / section director / super admin. Own sidebar: **Game Model** (Philosophy, Principles & Subprinciples, Age Group Defaults) · **Coaching Ops** (Attention, Coaches, Teams, Training Priorities, Adherence, Calendar) |
| Player plans | `/player-plans` | Team session → solo homework PDF |
| Admin | `/admin/*` | Platform staff |

Logged-in sidebar order: Coach Center → Session Builder → Vault → Favorites → Calendar → Tactical Board → Video Analysis (beta) → DOC Console (role) → Settings.

---

## Features (shipped)

**Coach Center** — one assigned team through the season. Curriculum across four moments of the game. Game-day sheet and match recap. API under `/coach-center/*`.

**Generation** — drills, sessions, progressive series. Structured constraints, QA grader, fixer, coach-level language. Session PDF rasterizes **stored** drill SVGs so print matches the vault (`apps/api/src/services/pdf-export.ts`). Compact export is landscape A4 **Coach’s Sheet**.

**Tactical Board** — live pitch, drawing, formation × phase chassis, principles library (v2 JSON), AI chat, session fork, PDF import. Design contract: `docs/tactical-board-phase-positioning.md`.

**DOC Console** — the club's game-model workspace plus coaching oversight.
- *Game model*: one club philosophy / DNA, then a structured library of **principles → subprinciples** (trigger / response / what-not-to-do) across the four moments of the game. **Age Group Defaults** hold per-club maturity notes and a readiness ceiling (formation complexity per age, sub-banded U13–14 vs U15–18) so U13–U18 stop generating identically. The structured model feeds a chained generation pipeline.
- *Coaching Ops*: **Training Priorities** — the DOC assigns a team's subprinciple for the week and it lands in that team's Coach Center curriculum; coaches see it read-only. **Adherence** ranks coaches on how closely their sessions track the assigned priorities, with advisory deviation warnings. Plus Club Attention, coach usage, team catalog, and calendar assign / auto-populate / reassign.
- Role-gated (DOC / section director / super admin). `DOC_HUB_HANDOFF.md` is an August 11 Phase 0 snapshot, not current status.

**Mobile app** (`apps/mobile`) — Expo / React Native. Tactical board native editor (list, create, read-only fidelity, native editor, frame timeline + playback, AI chat with photo attachment, device-driven pitch orientation) and Coach Center. Shares `@aci/shared` board libs with web. In development; not a store release. Changelog: `CHANGELOG.md`.

**Vault, calendar, player plans, video analysis (beta)** — still present. Video is not the newest flagship.

**Billing** — Starter Coach $10/mo, Club Pro $40/mo (5 seats), Academy Elite custom. Free trials closed on production.

---

## Frontend notes

- App chrome: `apps/web/src/components/AppHeader.tsx`
- Coach Center: `apps/web/src/app/coach-center/`
- DOC Console: `apps/web/src/app/doc-hub/`
- Session PDF download: `/api/export-session-pdf` → API `/ai/export-session-pdf`
- Trials: `apps/web/src/lib/trials.ts` and `apps/api/src/config/trials.ts`

Public marketing pages hide the app sidebar.

---

## Setup

See [`RUN_SERVERS.md`](./RUN_SERVERS.md). The API loads **root `.env`** (and `apps/api/.env` if present), not `.env.local`. Do not commit secrets. `apps/api/.env.example` has historically contained live-format credentials — do not copy those values into docs or git.

```bash
pnpm install
cd apps/api && pnpm dev    # :4000
cd apps/web && pnpm dev    # :3000
```

Then `/login` and `/coach-center`, not only `/demo/drill`.

---

## What not to treat as product docs

| Path | What it is |
|---|---|
| `apps/api/*.md` | Dec 2025 prompt/QA scratch. Paths still mention `/Users/macbook/Projects/aci`. |
| `docs/mobile/`, `docs/*_MOBILE_*.md` | Planning + inventory for `apps/mobile` (the app itself is real and in the repo). |
| `apps/web/README.md` | create-next-app boilerplate. |
| `TacticalEdge_*Pitch*.html` | Older 2 MB archive decks. Use `pitch-deck-*.html`. |

---

## Related

- Product + UI brief: `TACTICALEDGE_UI_PRODUCT_REPORT.md`
- Board principles: `docs/tactical-board/formation-principles-v2.md`
- Game-model authoring: `docs/game-model-template.md` (worked example: `docs/game-models/rocklin-fc.md`)
- Video MVP spec (historical; feature is beta): `SHORT_VIDEO_ANALYSIS_FEATURE_SPEC.md`
- Release process + version: `docs/release-process.md`, `CHANGELOG.md`, `VERSION`

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

## Branches & worktrees

| Branch | Typical use |
|---|---|
| `main` | Production / default |
| `codex/mobile-app` | Mobile + shared board/Coach Center work |
| `codex/web-prod-release` | Web release train |

Mobile source of truth for day-to-day Expo work is often the `aci-mobile-dev` worktree on `codex/mobile-app`. Other worktrees on `main` may lack `apps/mobile` after hotfixes — check before editing.

Render staging branch pin: [`docs/release-process.md`](docs/release-process.md).

---
