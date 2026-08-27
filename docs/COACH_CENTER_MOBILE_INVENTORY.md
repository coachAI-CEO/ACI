# Coach Center — Mobile Surface Inventory

Snapshot of what the mobile app exposes under `/coach-center/*`, what the
webapp exposes at `/coach-center/*`, and the remaining gap. Use together with
`COACH_CENTER_IMPLEMENTATION_PLAN.md`.

> **Status (2026-08):** Phases A–E shipped. Mobile has curriculum, next
> sessions, and season chat screens. Authoring (team create/edit, curriculum
> edit, rich game-day showcase) stays on web.

---

## 1. Mobile today

### Files

```
apps/mobile/app/coach-center/
├── index.tsx                                 # teams list + clubs + web CTA
├── [teamId]/
│   ├── index.tsx                             # team overview + section cards
│   ├── week.tsx                              # weekly calendar
│   ├── curriculum.tsx                        # 16-week curriculum (Phase C)
│   ├── next-sessions.tsx                     # recommendations + generate (Phase D)
│   ├── chat.tsx                              # season chat (Phase E)
│   └── game-days/
│       ├── index.tsx                         # game day packs list
│       └── [gameDayId].tsx                   # detail + match recap + share/PDF
apps/mobile/stores/coach-center.store.ts
apps/mobile/services/coach-center.service.ts
```

### Reach

- Home Quick Action → `/coach-center`
- Settings → Coach Center row → `/coach-center`
- Stack routes in `apps/mobile/app/_layout.tsx` for all screens above

### What the screens do

#### `index.tsx`
- `GET /coach-center/access` — clubs + teams list
- Open team → `coach-center/[teamId]`
- Web CTA for authoring on the site

#### `[teamId]/index.tsx`
- `GET /coach-center/teams/{teamId}/overview`
- This week / next match / upcoming / recommendations
- Section rows → curriculum, week calendar, game days, next sessions, season chat
- Build-this-session deep link into generate when params available
- Web CTAs for team settings / curriculum edit

#### `[teamId]/week.tsx`
- `GET /coach-center/teams/{teamId}/calendar?weekStart=`
- Prev / this / next week; Sideline / Session / Mark done actions

#### `[teamId]/curriculum.tsx` (Phase C)
- Season week chip strip + knowledge card + session breakdown
- Vault recommendations for selected week
- Build this session CTA

#### `[teamId]/next-sessions.tsx` (Phase D)
- Generate this week's session hero
- Recommendation list → vault / open

#### `[teamId]/chat.tsx` (Phase E)
- `GET`/`POST /coach-center/teams/{teamId}/chat`
- Message list + composer; week context in header

#### `game-days/*`
- List packs; detail with key focus pillars; basic match recap form
- Share text / PDF; edit pack on web

### State

- `useCoachCenterStore` — `selectedTeamId` (Zustand persist)
- Overview/season data fetched per screen; no offline Coach Center cache

---

## 2. Parity vs web

### Mobile has (consume path)

- Team list + clubs
- Team overview (week, match, upcoming, recommendations, section cards)
- Weekly calendar
- Curriculum week picker + knowledge card
- Next sessions + generate CTA
- Season chat (read + send)
- Game day packs + basic recap + PDF share

### Still web-only (authoring / denser UI)

| Web surface | Why it stays on web |
|---|---|
| Team create / settings | Wider forms, admin flags |
| Curriculum **edit** | Authoring canvas |
| Game day rich showcase / modes | Dense recap builder |
| Full DOC Hub / admin | Outside mobile scope |

### API usage

| Endpoint | Web | Mobile |
|---|---|---|
| `GET /coach-center/access` | ✓ | ✓ |
| `POST /coach-center/teams` | ✓ | ✗ (web) |
| `PATCH /coach-center/teams/:teamId` | ✓ | ✗ (web) |
| `GET .../overview` | ✓ | ✓ |
| `GET .../calendar` | ✓ | ✓ |
| `GET .../recommendations` | ✓ | ✓ |
| `GET`/`POST .../chat` | ✓ | ✓ |
| `GET`/`PATCH .../game-days` | ✓ | ✓ |
| `POST .../game-days` | ✓ | ✗ (web) |
| `GET .../game-days/:id/pdf` | ✓ | ✓ |

---

## 3. Related docs

- `docs/COACH_CENTER_IMPLEMENTATION_PLAN.md` — phase plan (A–E shipped; F+ open)
- `docs/mobile/README.md` — Expo handoff + roadmap
- `docs/CALENDAR_MOBILE_INVENTORY.md` — calendar surfaces used from Coach Center
