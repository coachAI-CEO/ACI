# Calendar — Web Inventory

Exhaustive walkthrough of the calendar surface inside `apps/web` and its supporting backend in `apps/api` + `packages/shared`. All references quote line numbers from the current files.

> Calendar on web is **three distinct surfaces**, not one: a coach-facing personal calendar at `/calendar`, a coach-center per-team week at `/coach-center/calendar`, and a DOC-Hub per-club multi-coach week at `/doc-hub/calendar`. They share the same `CalendarEvent` Prisma model but render very different UIs and have different feature parity (the personal page is the most feature-complete; the others are read-mostly week views with limited write paths).

---

## 1. File Map

### 1.1 Web pages

| File | Role |
|---|---|
| `apps/web/src/app/calendar/page.tsx` | Coach-facing **personal** training calendar (month + week view, event detail modal, delete, weekly-summary opener) |
| `apps/web/src/app/coach-center/calendar/page.tsx` | Per-team **week strip** the coach sees after selecting a team in `/coach-center` |
| `apps/web/src/app/doc-hub/calendar/page.tsx` | Suspense wrapper around `CalendarPageInner` (uses `useSearchParams`, line 2–13) |
| `apps/web/src/app/doc-hub/calendar/CalendarPageInner.tsx` | DOC Hub **multi-coach grid** with assign, auto-populate, reassign |

### 1.2 Web components

| File | Role |
|---|---|
| `apps/web/src/components/ScheduleSessionModal.tsx` | Single-session scheduling modal (date + time + location + team + notes + live conflict check) |
| `apps/web/src/components/ScheduleSeriesModal.tsx` | Bulk-schedule one vault series (per-session Date/Time pickers, shared Location/Team/Notes) |
| `apps/web/src/components/WeeklySummaryModal.tsx` | AI-generated parent-comm summary + PDF export |
| `apps/web/src/components/DatePicker.tsx` | Custom popup calendar (no library dep), used by the modals |
| `apps/web/src/components/TimePicker.tsx` | Custom AM/PM hour/minute picker |
| `apps/web/src/components/ConfirmModal.tsx` | Generic confirm dialog (used for the "Remove from Calendar" prompt) |

### 1.3 Web API routes (Next.js proxies to the API server)

| File | Methods | Upstream |
|---|---|---|
| `apps/web/src/app/api/calendar/events/route.ts` | `GET`, `POST` | `/calendar/events` |
| `apps/web/src/app/api/calendar/events/[eventId]/route.ts` | `GET`, `PATCH`, `DELETE` | `/calendar/events/:eventId` |
| `apps/web/src/app/api/calendar/weekly-summary/route.ts` | `GET` (JSON + `format=pdf`) | `/calendar/weekly-summary` |
| `apps/web/src/app/api/doc-hub/[...path]/route.ts` | passthrough catch-all | `/doc-hub/...` (incl. `/doc-hub/clubs/:clubId/calendar/*`) |
| `apps/web/src/app/api/coach-center/[...path]/route.ts` | passthrough catch-all | `/coach-center/...` (incl. `/coach-center/teams/:teamId/calendar`) |

### 1.4 API server (Express)

| File | Role |
|---|---|
| `apps/api/src/routes-calendar.ts` | All calendar REST endpoints, guarded by `authenticate` + `requireFeature('canAccessCalendar')` or `requireFeature('canGenerateWeeklySummaries')` (lines 39, 92, 213, 273, 300) |
| `apps/api/src/services/calendar.ts` | CRUD service. Defines `CreateCalendarEventInput` (lines 3–10) and `UpdateCalendarEventInput` (lines 12–20) |
| `apps/api/src/routes-doc-hub.ts` | DOC Hub calendar endpoints, lines 355–500 (week grid, assign, auto-populate, reassign) |
| `apps/api/src/services/club-calendar-assign.ts` | DOC Hub scheduling business logic: `assignSessionToCoach` (lines 224–269), `autoPopulateCoachWeek` (lines 280–380), `reassignCalendarEvent` (lines 382–444). Throws `DAY_CONFLICT`/`SESSION_NOT_IN_VAULT`/`COACH_OUT_OF_SCOPE`/`NO_MORE_SESSIONS` errors |
| `apps/api/src/services/weekly-summary.ts` | Aggregates events + emits AI summary text |
| `apps/api/src/services/pdf-export.ts` | Renders the weekly summary PDF |
| `apps/api/src/routes-coach-center.ts` | `GET /coach-center/teams/:teamId/calendar` (lines 79–89) — read-only team week |
| `apps/api/src/scripts/seed-pilot-calendar.ts` | Seed script for pilot calendar data |

### 1.5 Shared types

| File | Role |
|---|---|
| `packages/shared/src/types/calendar.ts` | Trivial stub (lines 1–8): `CalendarEvent { id, title?, startAt?, endAt?, date?, time? }`. **Not used by the web calendar code** — each page redefines its own shape. |

### 1.6 Prisma schema

`apps/api/prisma/schema.prisma` lines 639–686:

```
model CalendarEvent {
  id, userId, user
  sessionId, sessionRefCode
  scheduledDate DateTime
  durationMin   Int?
  notes, location, teamName (teamName is "legacy free-text"), teamId, team
  completed, cancelled
  originalCoachId, assignedByUserId, reassignedBy, reassignedAt  // DOC Hub audit trail (line 672-675)
  createdAt, updatedAt
  @@index([userId, scheduledDate])
}
```

> Notable: the schema has **no timezone, no recurrence, no color/tag, no iCal fields, no reminder fields**. The model is single-TZ (whatever JS `Date` gives you, coerced to UTC on `toISOString`) and non-recurring.

---

## 2. Current Screen Structure

### 2.1 `/calendar` — Coach personal calendar

A single tall page (`apps/web/src/app/calendar/page.tsx`, 593 lines). From top to bottom:

1. **Header bar** — page title "Training Calendar" (`calendar/page.tsx` line 265), subtitle "Schedule and manage your training sessions" (line 267), a `Back to Vault` link in the top right (lines 270–275).

2. **View-controls toolbar** (lines 279–343) on a `bg-slate-900/70` rounded card:
   - Left side: ← Previous button, **Today** button (emerald, line 287), → Next button, then the current range label (e.g. "August 2026" or "Aug 17 – Aug 23, 2026").
   - Right side: 📧 Weekly Summary button (blue, opens `WeeklySummaryModal`, line 305–321) and a `Month` / `Week` view-mode toggle (lines 304, 322, 332).

3. **Calendar grid body** (lines 345–471):
   - **Month view** (lines 350–413) — a 7-column grid filling 6 rows × 7 days = 42 cells (always, `while (days.length < 42)` line 163). Each day cell shows day-of-month + up to **3** event chips (`slice(0, 3)` line 387) + a "+N more" footer when overflow (line 403–406). Out-of-month days are dimmed (`bg-slate-900/20`, line 376); today is emerald-ringed (line 374).
   - **Week view** (lines 414–471) — 7-column layout, each column min-height `400px`. Header per column shows weekday + day-of-month. Event chips inside are full-width (cyan for upcoming, red-strikethrough for cancelled, slate for completed, lines 444–450). Each event shows time, title, and an optional 📍 location line.

4. **Event detail modal** (lines 474–569) — fixed-position `z-50` overlay with `bg-slate-950/90`. Shows:
   - Session title (line 480) with a date/time/duration badge row (lines 482–503) including a `sessionRefCode` chip in cyan.
   - `Age Group:` row when session info is hydrated (lines 514–521).
   - `Location` section (lines 523–528).
   - `Team` section (lines 530–535).
   - `Notes` section with a slate background quote block (lines 537–544).
   - **Actions footer** (lines 546–566): `View Session →` link to `/demo/session?sessionId=…`, a red `Remove from Calendar` button (opens `ConfirmModal`), and `Close`.

5. **`ConfirmModal`** (lines 572–581) — generic. Variant=danger, "Remove from Calendar / Are you sure… cannot be undone".

6. **`WeeklySummaryModal`** (lines 584–589) — see §2.4.

> No sidebar, no agenda tab, no search bar, no team / age / location filter, no drag-to-reschedule handlers anywhere in this file (search returned nothing for `drag|drop|DnD|reminder|notification|search|query|filter|agenda|day list`).

### 2.2 `/coach-center/calendar` — Coach center per-team week

`apps/web/src/app/coach-center/calendar/page.tsx` (129 lines). Read-mostly.

1. **Empty state** when no team is selected (lines 33–42) — single "Calendar needs a team" card with a CTA to `/coach-center/team` to create one.
2. **Header** (lines 46–73) — "Calendar" title, subtitle `Your training week for {team.name}. Team sessions are highlighted.` (line 50), then `Previous / This week / Next` buttons that mutate `weekStart` state (Monday-anchored — see `_lib/utils.ts:1`).
3. **Week range** line (lines 75–78): `Week of {weekStart} · loading…`.
4. **Seven-column day strip** (lines 80–111) — `grid gap-2 md:grid-cols-7`. Each card is `min-h-[160px]` with the day label (e.g. "Mon"), the date `MM-DD` slice (line 86), and an event list. Cells with no events render `Open` (line 89). Events whose `forThisTeam` flag is true get a sky-colored highlight (lines 95–97); others are slate.
5. **Footer** (lines 113–126) — `Plan this week's session` (deep-links to `selectedTeam.generateHref`, which itself encodes game-model/team/age) and `Open full calendar` (links to `/calendar`).

### 2.3 `/doc-hub/calendar` — DOC Hub per-club multi-coach grid

`apps/web/src/app/doc-hub/calendar/CalendarPageInner.tsx` (447 lines). Coach-management surface.

1. **Header row** (lines 250–269) — "Calendar" title, `Week of {weekStart} – {lastDate}` subtitle (lines 252–256), `Prev week / This week / Next week` (lines 259–267).

2. **5-column filter/action bar** (lines 271–324):
   - **Coach filter dropdown** (lines 272–283) — `All coaches (view)` default; options fall back to `usageRows` then to `calendarCoaches` (line 246). Reading query string `?coach=ID` (line 48) prefills the select.
   - **Day-of-week dropdown** (lines 284–294) — `Mon … Fri` only.
   - **Vault session dropdown** (lines 295–307) — `Select Vault session`; options from `/api/doc-hub/clubs/{clubId}/vault/sessions?limit=100` and show title + `(refCode) · ageGroup` (line 304).
   - **Add to Coach button** (`btnSecondary`, lines 308–315) — `disabled` until coach+session selected.
   - **Auto Populate Week button** (`btnPrimary`, lines 316–323) — `disabled` until coach selected.

3. **Status line** (line 326) — `assignMessage` in emerald.

4. **Reassignment inline form** (lines 328–362) — appears after clicking `Reassign` on a cell. `Select substitute coach` + `Confirm reassign` / `Cancel`.

5. **Calendar table** (lines 364–443) — Days as rows (Mon–Fri only, filtered at line 391), coaches as columns. Each cell renders one or more event blocks (lines 407–429) with title + `code · time` meta + a `Coverage` amber pill when `isCoverage` (lines 410–414) + a `Reassign` link.

> URL `?coach=ID&action=assign` triggers the `assignMessage` prepopulation on load (lines 47–54).

### 2.4 `/calendar` modals

#### `ScheduleSessionModal` — `apps/web/src/components/ScheduleSessionModal.tsx` (336 lines)

- Header (lines 200–217): `Schedule Session` title, session title + ref-code chip, ✕ close.
- Form fields (lines 219–282):
  - **Date** — `<DatePicker />` (lines 224–230) defaulting to today (`getDefaultDate()` line 183, returns `new Date().toISOString().split("T")[0]`); `min` constrained to today (line 227).
  - **Time** — `<TimePicker />` (lines 237–242) defaulting to **next hour** on the dot (`getDefaultTime()` lines 176–180, `setHours(now.getHours()+1, 0, 0, 0)`).
  - **Location (Optional)** — single-line `text` input with placeholder "e.g., Field 1, Main Facility" (lines 245–256).
  - **Team/Group (Optional)** — single-line text with placeholder "e.g., U12 Team A, Senior Squad" (lines 258–269).
  - **Notes (Optional)** — `<textarea rows={3}>` (lines 271–282).
- **Live conflict panel** (lines 42–113, 284–307): every date/time change re-fetches `/api/calendar/events` for that day (`dayStart` / `dayEnd`, lines 53–57) and intersects the new `[newStart, newEnd]` interval against every existing event (interval-overlap formula `newStart < existingEnd && newEnd > existingStart` line 94). Renders an amber warning card listing each conflict's time/title/duration and *warns but does not block* submission (line 303–305: "You can still schedule this session, or pick a different time").
- Error / submit footer (lines 309–330).

> **Missing fields per the task spec**: no duration picker, no team picker, no color/tag picker, no recurrence option. Default duration is taken from `sessionDurationMin` prop (default 60, line 28) and copied to `durationMin` server-side at `calendar.ts:46`.

#### `ScheduleSeriesModal` — `apps/web/src/components/ScheduleSeriesModal.tsx` (319 lines)

Iterates over `sessions: SeriesSession[]`. For each session it auto-fills `defaultDate = today + index` (line 49) and `defaultTime = next hour` (line 53), editable via `DatePicker` + `TimePicker`. Shared Location / Team / Notes fields below (lines 250–290). On submit it POSTs all sessions in parallel via `Promise.all` (line 124); each failure rolls the whole batch back via the thrown error.

> Series scheduling here ≠ recurring events — it's just bulk one-off scheduling of multiple distinct vault sessions stored in a series. **No RRULE / recurrence UI exists anywhere.**

#### `WeeklySummaryModal` — `apps/web/src/components/WeeklySummaryModal.tsx` (425 lines)

- Sticky header (lines 240–272): `Weekly Training Summary` title, date range `weekStart – weekEnd`, `Select Week:` `<DatePicker />` (Sun-anchored week, see `getWeekRange` lines 53–62), ✕ close.
- Loading spinner with "Generating AI summary…" copy (lines 276–282).
- AI summary panel (lines 293–305) when present — emerald-tinted card.
- Stats grid (lines 308–336): Total Sessions, Total Time (hrs + min from `totalMinutes`), Age Groups, Focus Areas (game-models mapped through `gameModelLabel` lines 39–45).
- Events-by-day list (lines 339–394) — each day gets a card with all sessions nested, each event shows time, duration, location, team, age group, notes, ref code.
- Footer (lines 397–417): `📋 Copy Text` (uses `summary.aiSummary || text`, line 202), `📄 Export PDF` (calls `?format=pdf`, downloads `weekly-summary-{weekStart}-{weekEnd}.pdf`, lines 169–191), `Close`.

---

## 3. Capabilities

### 3.1 Personal calendar (`/calendar`)

| Capability | Status | Evidence |
|---|---|---|
| View month (42-cell grid) | ✅ | `viewMode === "month"` branch, lines 153–168, 350–413 |
| View week (7-column strip) | ✅ | `viewMode === "week"` branch, lines 171–180, 414–471 |
| View day / agenda | ❌ | No day view; no list/agenda view in the file |
| Navigate ← Today → | ✅ | lines 122–140 |
| View event details (modal) | ✅ | lines 474–569 |
| Inline edit | ❌ | Only View + Remove actions; **no PATCH path is invoked from this UI** |
| Modal-driven edit | ❌ | `PATCH` proxy route exists (`apps/web/src/app/api/calendar/events/[eventId]/route.ts:52`) but no caller |
| Delete event (with confirm) | ✅ | `handleDeleteEvent` line 205 + `ConfirmModal` line 572; `DELETE` proxy line 223 |
| Mark completed | ❌ | `completed` field exists on the model (`schema.prisma:662`) and `PATCH` accepts it (`calendar.ts:247`), but no UI toggle |
| Mark cancelled | ❌ | Same — `cancelled` field with strikethrough style (line 393) shown read-only; no toggle UI |
| Search | ❌ | No search input anywhere |
| Filter by team | ❌ | UI shows `teamName` field on the event but no filter control |
| Filter by age group | ❌ | Only shown in modal detail (line 518) |
| Filter by location / type / owner | ❌ | — |
| Mini-calendar (date picker outside grid) | ❌ | — |
| Create-event modal | ✅ (called from elsewhere) | `ScheduleSessionModal` and `ScheduleSeriesModal` — but `/calendar` page itself never opens them; the modals are loaded by vault/series pages (confirmed via `Grep` — they aren't referenced in the calendar page file) |
| Drag-to-reschedule | ❌ | No `onDragStart`/`onDrop`/`DndContext` in any calendar file |
| View scheduled session | ✅ | `View Session →` link → `/demo/session?sessionId=…` line 547–552 |
| Recurring events | ❌ | No RRULE / recurrence field anywhere |
| Reminders / notifications | ❌ | No UI in web; mobile has a separate `NotificationSettings.tsx` but it's not wired into the calendar |
| iCal import | ❌ | — |
| iCal export / PDF export | ⚠️ Partial | Only the **weekly summary** has PDF export (`WeeklySummaryModal:155-198`); no per-event iCal |
| Conflict detection (same-day overlay) | ✅ | `ScheduleSessionModal` client-side, lines 42–113; server uses `findDayConflicts` only on DOC Hub (`club-calendar-assign.ts:92-108`) |
| Timezone handling | ❌ Single TZ | All dates are JS `Date` → `toISOString()` (UTC); client formats via `toLocaleDateString`/`toLocaleTimeString` lines 183, 198. **No `Intl.DateTimeFormat({ timeZone })` overrides** anywhere. `mondayWeekStartIso` in coach-center / doc-hub utilities explicitly builds in `Date.UTC(...)` (lines 1–7, both util files) |
| Owner-only permissions | ✅ | `getCalendarEvent` filters by `userId` (`calendar.ts:165-178`); update/delete do the same (`calendar.ts:191-200, 226-235`). The API server comment on `routes-calendar.ts:5-6, 26` explicitly states calendar is **not admin-gated** but is owner-scoped per user |

### 3.2 Coach center (`/coach-center/calendar`)

| Capability | Status | Evidence |
|---|---|---|
| Week view (Mon-anchored, 7 cols) | ✅ | lines 80–111 |
| Navigate ← This week → | ✅ | lines 56–70 |
| Highlight "for this team" events | ✅ | `forThisTeam` boolean drives sky vs slate styles lines 95–97 |
| Create event | ❌ | Surface only links back to `/calendar` or forward to `/generate`; no inline create |
| Conflict detection | ❌ | — |
| Search / filter | ❌ | — |
| Read-only | ✅ | No POST/PATCH/DELETE calls |

### 3.3 DOC Hub (`/doc-hub/calendar`)

| Capability | Status | Evidence |
|---|---|---|
| Multi-coach grid (coaches × days Mon–Fri) | ✅ | HTML table at lines 372–442 |
| Coach selector | ✅ | lines 272–283 |
| Day-of-week selector | ✅ | lines 284–294 |
| Vault session picker | ✅ | lines 295–307 |
| Add to Coach (single) | ✅ | `handleAddToCoach` lines 146–181; backend `assignSessionToCoach` `club-calendar-assign.ts:224-269` enforces `DAY_CONFLICT` 409 if coach already has a session that day |
| Auto Populate Week | ✅ | `handleAutoPopulate` lines 183–215; backend `autoPopulateCoachWeek` lines 280–380 — fills Mon–Fri at `defaultTime` (defaults to `17:00`, line 198 / line 272–278), respects `skipDaysWithEvents` (default true), cycles through vault sessions round-robin, returns `created`/`skipped` arrays |
| Reassign event to substitute coach | ✅ | `handleReassign` lines 217–244; backend `reassignCalendarEvent` lines 382–444 preserves `originalCoachId`, writes `reassignedBy` + `reassignedAt` |
| `Coverage` badge for reassigned events | ✅ | `isCoverage` boolean in cell mapping; amber pill lines 410–414 |
| Recurring events | ❌ | — |
| Reminders | ❌ | — |
| iCal import / export | ❌ | — |
| Timezone | Mon–Fri UTC | `scheduledDateForAssignDay` always puts events at 17:00 UTC (`CalendarPageInner.tsx:21-27`); the backend also uses UTC day-bounds (`club-calendar-assign.ts:83-90`) |
| Permissions | DOC / Section Director (enforced server-side) | `routes-doc-hub.ts:361` `requireClubRole(DOC_HUB_ROLES)` + `assertRequesterManagesCoach` (`club-calendar-assign.ts:43-81`) throws `COACH_OUT_OF_SCOPE` 403 for coaches not in the requester's section |

### 3.4 Weekly summary (cross-cutting)

| Capability | Status | Evidence |
|---|---|---|
| Aggregate events by week | ✅ | `generateWeeklySummary` (`apps/api/src/services/weekly-summary.ts`, imported at `routes-calendar.ts:18`) |
| AI parent-comm summary | ✅ | Returned as `summary.aiSummary` (`WeeklySummaryModal:146`); uses Gemini by way of the `generateWeeklySummary` implementation |
| Copy text to clipboard | ✅ | `handleCopyText` lines 200–205 |
| PDF export | ✅ | `WeeklySummaryModal:155-198` posts `format=pdf` and downloads the file |
| Per-day breakdown | ✅ | lines 339–394 |

---

## 4. Type Summary

### 4.1 Backend / DB shape (canonical)

`CalendarEvent` (Prisma, lines 639–686):
- `id: string`
- `userId: string` (owner)
- `user: User` (relation, `select: { id, name, email }` on create)
- `sessionId: string`
- `sessionRefCode: string | null` (denormalized)
- `scheduledDate: DateTime`
- `durationMin: Int?`
- `notes: string?`
- `location: string?`
- `teamName: string?` (free-text "legacy")
- `teamId: string?` (FK to `Team`)
- `team: Team?`
- `completed: Boolean` (default false)
- `cancelled: Boolean` (default false)
- `originalCoachId: string?` (DOC Hub audit, set once on creation)
- `assignedByUserId: string?` (who created it if not the coach)
- `reassignedBy: string?` (most recent handoff)
- `reassignedAt: DateTime?`
- `createdAt`, `updatedAt`

DTOs (`apps/api/src/services/calendar.ts`):
- `CreateCalendarEventInput` (lines 3–10): `{ sessionId, scheduledDate, durationMin?, notes?, location?, teamName? }`
- `UpdateCalendarEventInput` (lines 12–20): adds `{ completed?, cancelled? }`

> No `startAt`/`endAt` pair; `endAt` is always computed from `scheduledDate + durationMin * 60_000`.

### 4.2 Frontend local shapes (each page re-declares its own)

**`/calendar`** — `CalendarEvent` type at `calendar/page.tsx:8-25`:
```
{ id, sessionId, sessionRefCode, scheduledDate, durationMin, notes, location,
  teamName, completed, cancelled,
  session?: { id, title, ageGroup, durationMin } }
```
`gameModelLabel` lookup at lines 27–33.

**`/coach-center/calendar`** — `CalendarDay` type at `coach-center/_lib/types.ts:68-79`:
```
{ date, dayLabel,
  events: Array<{ id, time, location, completed, forThisTeam,
                  session: { id, title, refCode, durationMin } | null }> }
```

**`/doc-hub/calendar`** — `CalendarCoach`, `CalendarCellEvent`, `CalendarDay` at `doc-hub/_lib/types.ts:36-54`:
```
CalendarCoach = { userId, name, roleLabel }
CalendarCellEvent = { eventId, title, code, time, isCoverage? }
CalendarDay = { date, dayLabel, cells: Record<coachUserId, CalendarCellEvent[]> }
```
Plus `VaultSessionOption` (lines 56–62) for the picker.

**`shared/types/calendar.ts`** — placeholder shape (lines 1–8):
```
{ id, title?, startAt?, endAt?, date?, time? }
```
Not referenced anywhere in the web codebase.

### 4.3 Modal-level shapes

- `ScheduleSessionModal`:
  - `ConflictingEvent` (lines 7–12): `{ id, title, scheduledDate, durationMin }`
  - Props (`lines 14-22`): `{ sessionId, sessionTitle, sessionRefCode?, sessionDurationMin=60, onClose, onScheduled? }`
- `ScheduleSeriesModal`:
  - `SeriesSession` (lines 7–11): `{ id, title, refCode? }`
  - Props (`lines 13-19`): `{ seriesId, seriesTitle, sessions: SeriesSession[], onClose, onScheduled? }`
  - Internal `Map<sessionId, { date, time }>` (line 29)
- `WeeklySummaryModal`:
  - `WeeklySummary` (lines 12–37) with `events[]` containing `{ id, sessionId, sessionRefCode, scheduledDate, durationMin, location, teamName, notes, session: { id, title, ageGroup, gameModelId, durationMin } | null }`
  - `gameModelLabel` map (lines 39–45)

---

## 5. Notable UX Patterns

1. **Three identical-shaped but differently-purposed surfaces.**
   The same `CalendarEvent` table backs `/calendar` (personal), `/coach-center/calendar` (per-team), and `/doc-hub/calendar` (per-club-grid). The personal surface is the only one that talks to the generic `/calendar/events` REST endpoints and supports the `Completed`/`Cancelled` rendering; the coach-center surface is read-only through `/coach-center/teams/:teamId/calendar`; the DOC Hub surface writes through the club-scoped endpoints `/doc-hub/clubs/:clubId/calendar/{assign,auto-populate,reassign}` plus the audit fields on the model.

2. **Permission model is two-tier.**
   - Personal endpoints (`/calendar/events`) are gated by `authenticate` + `requireFeature('canAccessCalendar')` and filter by `userId` so coaches can only see their own events (`routes-calendar.ts:92`, `services/calendar.ts:165-200`). The whole file's banner comment (`routes-calendar.ts:5-6, 26`) emphasises that calendar is intentionally **not** admin-gated, yet the proxy log on `apps/web/src/app/api/calendar/events/route.ts:104-108` has a defensive warning left over from when this was incorrectly enforced.
   - DOC Hub endpoints are gated by `requireClubRole(DOC_HUB_ROLES)` plus `assertRequesterManagesCoach` which checks `COACH_OUT_OF_SCOPE` and rejects coaches that aren't in the requester's section (`club-calendar-assign.ts:43-81`).

3. **Audit trail baked into the model.**
   Adding a session for someone else writes `originalCoachId` and `assignedByUserId` (lines 263–264 of `club-calendar-assign.ts`); reassigning writes `reassignedBy` + `reassignedAt` while preserving `originalCoachId` (lines 426–435). The DOC Hub UI surfaces this as a yellow `Coverage` pill (`CalendarPageInner.tsx:410-414`).

4. **Sunday- vs Monday-anchored weeks.**
   - `/calendar` uses Sunday-anchored weeks (`currentDate.getDay()` offset, lines 56–63 of `calendar/page.tsx`).
   - `WeeklySummaryModal` also uses Sunday-anchored weeks (`getWeekRange` lines 53–62).
   - Coach-Center and DOC-Hub use **Monday-anchored** weeks via `mondayWeekStartIso()` (`coach-center/_lib/utils.ts:1-7`, `doc-hub/_lib/utils.ts:1-7` — both compute `offset = day === 0 ? -6 : 1 - day`).
   - The Monday-anchored variants intentionally construct in UTC (`Date.UTC(...)`) which is a softer timezone contract than local-noon.

5. **Sunday-start of week + half-page month view.**
   The month grid always renders **42 cells** (six weeks × seven days, line 163 of `calendar/page.tsx`). This means weeks starting on Sunday leak into adjacent months and the visual style dims those (`bg-slate-900/20` line 376).

6. **Capped event density in month cells.**
   Month cells only render the first **3** events as inline chips (`slice(0, 3)` line 387) and add a `+N more` counter (line 403–406) but there is **no** click-to-expand drawer for the overflow — clicking the cell body does nothing.

7. **`+12 stepper` everywhere.**
   Clicking "Next" in week mode adds `7 * 24 * 60 * 60 * 1000` ms to `currentDate` (line 134). On the Sunday boundary this can land in an unexpected month; in the month mode it's `setMonth(month + 1)` (line 132). Two different navigation models, no shared util.

8. **Single-style event chip with state color.**
   Events get one of three classes based on `cancelled` → red strikethrough, `completed` → slate, else → cyan (`calendar/page.tsx:391-397`). No per-team color, no per-session-type color, no tag-based color.

9. **Conflict UX is non-blocking.**
   `ScheduleSessionModal`'s server-side POST doesn't validate (it just `prisma.calendarEvent.create`s), and the client-side overlay is advisory only (`apps/web/src/components/ScheduleSessionModal.tsx:303-305` explicitly says "You can still schedule this session…"). The DOC Hub *does* hard-block via `DAY_CONFLICT 409` (`club-calendar-assign.ts:241-251`) — note the asymmetry.

10. **Live conflict check fires every date-time change.**
    `ScheduleSessionModal:111-113` re-runs the overlap check via `useEffect → checkConflicts` on every keystroke. This means a date flicker re-hits `/api/calendar/events` — a small but real footgun if a coach picks dates quickly.

11. **Default time conventions differ between surfaces.**
    - `ScheduleSessionModal`: `getDefaultTime` = next full hour from now (`apps/web/src/components/ScheduleSessionModal.tsx:176-180`).
    - `ScheduleSeriesModal`: same convention, but every session is offset by an extra day (line 49: `setDate(today + index)`), so users get a chain of N consecutive-day events at the same time.
    - DOC Hub auto-populate: hard-coded `defaultTime: "17:00"` UTC (`CalendarPageInner.tsx:198`, `club-calendar-assign.ts:272-278`).
    - `assignMode` on the doc hub: 17:00 UTC (`CalendarPageInner.tsx:21-27`).

12. **Token plumbing is brittle.**
    All web pages read `accessToken` via raw `localStorage.getItem` (e.g. `calendar/page.tsx:72, 217`, `ScheduleSessionModal.tsx:60, 121`, `WeeklySummaryModal.tsx:101, 159`). Coach-center and DOC-Hub wrap this in an `authHeaders()` helper (`coach-center/_lib/utils.ts:27-30`, `doc-hub/_lib/utils.ts:40-43`).

13. **Weekly summary is the only place PDF export exists.**
    Both the API route (`apps/web/src/app/api/calendar/weekly-summary/route.ts:67-76`) and the modal (`WeeklySummaryModal.tsx:155-198`) pipe through `?format=pdf`, but **per-event iCal/`.ics` export and import are not implemented** at any layer (no `ics`/`ical`/`rrule` text in `apps/web`, `apps/api`, or `packages/shared`).

14. **`gameModelLabel` is duplicated in two files.**
    `calendar/page.tsx:27-33` and `WeeklySummaryModal.tsx:39-45` define the same `POSSESSION / PRESSING / TRANSITION / COACHAI / ROCKLIN_FC → string` map. Drift risk.

15. **Backend has no recurrence / no timezone / no reminder column.**
    Schema fields & GET params confirm there is no recurrence (`rrule`/`RecurrenceRule` not found anywhere in `apps/`), no per-event `timeZone` (everything is UTC ISO + browser `toLocale*`), and no `reminderOffsetMinutes` (only the unrelated `apps/mobile/components/notifications/NotificationSettings.tsx` exists and is mobile-side).

16. **Auto-populate is a Mon–Fri-only loop.**
    `autoPopulateCoachWeek` in `apps/api/src/services/club-calendar-assign.ts:336-372` iterates exactly `i = 0..4`, skipping Saturday and Sunday. The UI mirrors this with the `Mon,Tue,Wed,Thu,Fri` `<select>` (`CalendarPageInner.tsx:289`). The `forThisTeam` cell mapping in coach-center is also Mon–Sun and surfaces any weekend sessions that snuck in via direct scheduling.

17. **`/calendar` is essentially read-only despite full CRUD backend.**
    Creation only happens via the ScheduleSessionModal which is loaded by other screens (vault, session-detail). The page itself has no "Create" button. Editing is similarly absent: the backend has `PATCH /calendar/events/:id` (`apps/web/src/app/api/calendar/events/[eventId]/route.ts:52`) but the calendar page never calls it.

18. **`Today` is rendered two different ways.**
    The `Today` pill in the toolbar (`calendar/page.tsx:287-292`) navigates and resets view; `dateKey === today` triggers an emerald cell background in the grid (lines 374). There's no equivalent quick-jump in coach-center / doc-hub — they only have prev/next week.

19. **Coach Center surfaces `forThisTeam` but never lets you toggle the filter.**
    Events come back from the API with `forThisTeam` precomputed (`coach-center/_lib/types.ts:76`). The page styles them differently (sky vs slate, lines 95–97) but offers no UI to e.g. hide non-team events.

20. **No empty-state copy on the personal calendar.**
    `/calendar` shows empty day cells with no events; the only error UI is `Loading calendar…` and the error message string (`calendar/page.tsx:346-348`). Coach-center has `Open` (line 89). DOC Hub has `No coaches to show` (line 370) but no copy for "no events scheduled."
