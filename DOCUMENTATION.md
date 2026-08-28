# TacticalEdge — Engineering Documentation

**Last updated:** 27 August 2026  
**Brand:** TacticalEdge (repo and some logs still say ACI)

Marketing and decks: [`TACTICALEDGE_UI_PRODUCT_REPORT.md`](./TACTICALEDGE_UI_PRODUCT_REPORT.md).  
Local run: [`RUN_SERVERS.md`](./RUN_SERVERS.md).  
Skill routing: [`CLAUDE.md`](./CLAUDE.md).

This file is the engineering map of what is in the repo now. It is not a January changelog.

---

## Overview

TacticalEdge is a soccer coaching OS. Coaches run a season from **Coach Center**, generate drills and sessions with tactical diagrams, teach on **Tactical Board**, and export session PDFs. Directors run philosophy and staff oversight from the **DOC Console**.

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
├── apps/api/          Express API (generation, vault, Coach Center, DOC Hub, boards, PDFs)
├── apps/web/          Next.js app (marketing + authenticated product)
├── docs/              Board design contract, mobile plan (mobile is not shipped)
├── pitch-deck-*.html  Audience decks (source of truth is the product report)
└── CLAUDE.md          Agent routing
```

Data flow: browser → Next.js (`/api/*` proxies) → Express → Gemini / Prisma → PostgreSQL.

Mounted API routers (`apps/api/src/app.ts`): auth, drills, sessions, vault, favorites, calendar, billing, video analysis, DOC Hub, Coach Center, boards, diagram SVG, admin, player plans, skill focus.

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
| DOC Console | `/doc-hub` | DOC / section director / super admin |
| Player plans | `/player-plans` | Team session → solo homework PDF |
| Admin | `/admin/*` | Platform staff |

Logged-in sidebar order: Coach Center → Session Builder → Vault → Favorites → Calendar → Tactical Board → Video Analysis (beta) → DOC Console (role) → Settings.

---

## Features (shipped)

**Coach Center** — one assigned team through the season. Curriculum across four moments of the game. Game-day sheet and match recap. API under `/coach-center/*`.

**Generation** — drills, sessions, progressive series. Structured constraints, QA grader, fixer, coach-level language. Session PDF rasterizes **stored** drill SVGs so print matches the vault (`apps/api/src/services/pdf-export.ts`). Compact export is landscape A4 **Coach’s Sheet**.

**Tactical Board** — live pitch, drawing, formation × phase chassis, principles library (v2 JSON), AI chat, session fork, PDF import. Design contract: `docs/tactical-board-phase-positioning.md`.

**DOC Console** — club philosophy, coach usage, Club Attention, teams, calendar assign / auto-populate / reassign. Phases 1–3 are live. Phase 4 (alerts, topic board, AI monitoring) is still deferred. The August 11 file `DOC_HUB_HANDOFF.md` is a Phase 0 snapshot, not current status.

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
| `docs/mobile/` | Unbuilt React Native plan. |
| `apps/web/README.md` | create-next-app boilerplate. |
| `TacticalEdge_*Pitch*.html` | Older 2 MB archive decks. Use `pitch-deck-*.html`. |

---

## Related

- Product + UI brief: `TACTICALEDGE_UI_PRODUCT_REPORT.md`
- Board principles: `docs/tactical-board/formation-principles-v2.md`
- Video MVP spec (historical; feature is beta): `SHORT_VIDEO_ANALYSIS_FEATURE_SPEC.md`

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
