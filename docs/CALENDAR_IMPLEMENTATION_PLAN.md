# Mobile Calendar — Full-Fledged Implementation Plan

**Scope:** Mobile (`apps/mobile/`) only. Backend already supports everything we need (no server work required). Based on the inventories in `docs/CALENDAR_{MOBILE_INVENTORY,WEB_INVENTORY,BACKEND_API}.md`.

**Goal:** Replace the current flat "next 30 days" list with a real calendar — view-switching (month/week/agenda), day picker, event detail, edit modal, create sheet with team/location/notes, conflict warnings, group-by-day list, filter chips, reminder-reliability fixes, type consolidation.

---

## 0. Ground rules

- **No backend changes.** Every API we need already exists in `/calendar/events*` (CRUD) + `/calendar/weekly-summary` (read).
- **Reuse the existing `PickerSheet`, `Button`, `Card`, `Input` primitives.** Build new ones only when needed (`WeekStrip`, `MonthGrid`, `DayHeader`, `EventRow`, `ConflictBanner`).
- **Stay inside `canAccessCalendar` gates.** All new UI lives under the same gate.
- **Single shared type.** Lift the mobile's `CalendarEventItem` into `@aci/shared` and replace the 4 duplicate declarations (mobile, web, web-coach-center, web-doc-hub) over time as a follow-up. For the mobile-only Phase 1 we'll move just what mobile uses.

---

## 1. Phase plan

### Phase A — Type consolidation (XS, prerequisite)

Move `CalendarEventItem` from `apps/mobile/services/calendar.service.ts` into `packages/shared/src/types/calendar.ts`. Add the canonical fields the backend returns (`scheduledDate`, `durationMin`, `location`, `teamName`, `notes`, `completed`, `cancelled`, `sessionId`, `sessionRefCode`, `userId`, plus `session` join shape).

- **Touch:** `packages/shared/src/types/calendar.ts` (replace stub), `apps/mobile/services/calendar.service.ts` (drop local type), every consumer (`calendar.tsx`, `index.tsx`, `vault.tsx`, `vault/series/[seriesId].tsx`, `vault/session/[sessionId].tsx`, `hooks/useReminderSync.ts`, `UpcomingEventItem.tsx`).
- **Risk:** low — type-only changes, runtime payload is already correct.
- **Effort:** XS (≤0.25 day).

### Phase B — Read surface: month + week + day-agenda (M)

Replace the flat list in `apps/mobile/app/(tabs)/calendar.tsx` with a tabbed read view backed by a shared `useCalendarEvents(anchor, range)` hook.

**Components (new, in `apps/mobile/components/calendar/`):**
- `MonthGrid` — 7×6 grid; each cell renders day number + up to 3 chips (`EventChip`) + `+N more` overflow badge. Tap a day → opens `DayAgenda` for that date. Tap a chip → opens event detail.
- `WeekStrip` — 7 columns, scrollable horizontally for past weeks; each column is a `DayColumn` listing `EventRow`s.
- `DayAgenda` — single-day flat list grouped by section header; used both as a tab and as the day-detail drill-in from MonthGrid.
- `EventRow` — small card: time, title, optional team/location, status dot (completed/cancelled). Tap → opens `EventDetailSheet`. Long-press → action sheet (Mark done / Reschedule / Delete / Cancel).
- `DayHeader` — `<day-name> <date>` + "Today" pill if applicable.
- `Toolbar` — `< Prev  Today  Next >` + segmented Month / Week / Agenda + `+` FAB.

**Files to modify:**
- `apps/mobile/app/(tabs)/calendar.tsx` — rewrite to host the toolbar + view switcher + active view component. Keep the Weekly Summary block as a card below.
- `apps/mobile/services/calendar.service.ts` — add `getCalendarEventsByDate(start, end)` (already exists server-side as `groupByDate=true`) and use it for the agenda view.
- `apps/mobile/hooks/useCalendarEvents.ts` (new) — single `useQuery` keyed on `[anchor, range]`, defaults to a 90-day window for month view, 14-day for week, 1-day for agenda; supports prefetch of neighbours so nav is instant.
- `apps/mobile/hooks/useReminderSync.ts` — unchanged but verify the new shared type imports.

**Effort:** M (1.5–2 days). Highest-risk phase because it's a UI rewrite. Plan: ship a `?view=agenda` URL param defaulting to agenda first; users see the new read surface immediately; month/week behind tabs for v1.

### Phase C — Create / edit / detail (M)

Today the only create flow is `ScheduleSessionSheet` (date + time + duration) opened from session detail / result screens, plus the inline form on the calendar tab (no team/location/notes). Plan:

1. **Refactor `ScheduleSessionSheet` → `EventSheet`** — same Modal pattern, now takes either `eventId` (edit) or `{ sessionId, sessionTitle, sessionRefCode, sessionDurationMin }` (create). Adds Location, Team, Notes fields (matching web's `ScheduleSessionModal`). Edit mode prefills them; saves via `updateCalendarEvent(eventId, payload)`.
2. **Build `EventDetailSheet`** — read-only detail with title, date/time, duration, location, team, notes, ref code, and a footer of actions: `Edit`, `Mark complete`/`Mark incomplete`, `Cancel` (sets `cancelled: true`), `Delete` (with confirm). Wire from any tap on `EventRow` or `EventChip`. Web parity: matches the event-detail modal in `apps/web/src/app/calendar/page.tsx:474–569`.
3. **Wire `EventSheet` from:** session result, session detail, series detail "Schedule all", session detail "Schedule…", and the calendar tab's `+` FAB. Delete the inline create form from `calendar.tsx`.
4. **Add conflict warning** — port web's live-conflict logic (`ScheduleSessionModal:42–113`): when date/time changes, refetch events for the day, intersect `[start, end]` with each existing event, render an amber `ConflictBanner` row inside the sheet. Advisory only (not blocking).

**Touch:**
- `apps/mobile/components/calendar/ScheduleSessionSheet.tsx` — rename to `EventSheet.tsx`; extend fields; add conflict logic.
- `apps/mobile/components/calendar/EventDetailSheet.tsx` (new).
- `apps/mobile/components/calendar/ConflictBanner.tsx` (new).
- `apps/mobile/app/(tabs)/calendar.tsx` — drop inline form, add `+` FAB that opens `EventSheet` for create.
- `apps/mobile/app/session/result.tsx`, `apps/mobile/app/vault/session/[sessionId].tsx`, `apps/mobile/app/vault/series/[seriesId].tsx` — switch to the new sheet.
- `apps/mobile/services/calendar.service.ts` — already has all CRUD calls; no changes needed.

**Effort:** M (1–1.5 days). Phased: ship edit/delete/cancel first (no create flow changes), then create with conflict warnings.

### Phase D — Series scheduling dialog (S)

Today `vault/series/[seriesId].tsx:96–124` hard-codes weekly Wednesdays at 6 PM. Replace with a real `ScheduleSeriesSheet` that mirrors web's `ScheduleSeriesModal` (date/time per part, shared Location/Team/Notes, conflict check per part).

- **New file:** `apps/mobile/components/calendar/ScheduleSeriesSheet.tsx`
- **Touch:** `apps/mobile/app/vault/series/[seriesId].tsx` — replace `onScheduleAll` to open the sheet; `apps/mobile/components/vault/VaultCards.tsx` if needed.

**Effort:** S (0.5 day).

### Phase E — Filter chips (S)

Add a horizontal `FilterChips` strip at the top of the calendar tab:

- **Time range**: This week / Next 2 weeks / This month / Next 3 months (controls `range`).
- **Team**: All / Team A / Team B / … (filtered client-side; reads `teamName`/`teamId` from events; coach picks from a free-text list of distinct teams they've already scheduled).
- **Status**: All / Active / Completed / Cancelled (mapped to `includeCompleted` / `includeCancelled` query params).

No backend changes — the existing `GET /calendar/events` query params cover it (`includeCompleted`, `includeCancelled`, `startDate`, `endDate`).

- **New file:** `apps/mobile/components/calendar/FilterChips.tsx`
- **Touch:** `apps/mobile/app/(tabs)/calendar.tsx`, `apps/mobile/hooks/useCalendarEvents.ts`.

**Effort:** S (0.5 day). Phase E is gated on Phase B (the new hook needs to accept filter params).

### Phase F — Reminders reliability (S)

Several issues surfaced in the inventory:
- `setBadgeCount` is called twice with no debounce (calendar.tsx:80 + 100).
- Notification taps are dropped — the data payload sets `eventId` but nothing reads it.
- Cancelled events aren't excluded from reminder scheduling (`useReminderSync` filters on `!cancelled` only via `getVaultCalendarEvents`, but the calendar tab's eventsQuery doesn't).
- "Schedule all" can duplicate events.
- Notification body always says "Training Session" because no caller passes a `title`.

**Touch:**
- `apps/mobile/hooks/useReminderSync.ts` — add cancelled filter; rebuild notification body from `event.session?.title || event.teamName || event.location`; debounce badge update.
- `apps/mobile/services/notifications.service.ts` — on `addNotificationReceivedListener`, route the tap to `/calendar/event/[eventId]` if `data.eventId` is set.
- `apps/mobile/app/(tabs)/calendar.tsx` — drop the manual `setBadgeCount(0)` on mount; let `useReminderSync` own the badge.
- `apps/mobile/app/vault/series/[seriesId].tsx` — guard the schedule-all loop to skip parts that already have a calendar event (so re-tap doesn't double-schedule).

**Effort:** S (0.5 day). Independent of B/C/D/E.

### Phase G — Offline cache (M)

Today only vault sessions are cached (`offline-cache.service.ts`). Add a calendar cache that stores the last-fetched events and serves them on read when offline. Writes stay online-only.

- **Touch:**
  - `apps/mobile/services/offline-cache.service.ts` — add `getCachedEvents`/`setCachedEvents` + `cachedEventMapVersion` key.
  - `apps/mobile/hooks/useCalendarEvents.ts` — `networkMode: 'offlineFirst'` with stale cache fallback (uses `@tanstack/react-query`'s built-in `persister`).
  - `apps/mobile/components/offline/OfflineEmptyState.tsx` (already exists in vault) — add a "calendar last synced" timestamp footer when serving cached data offline.

**Effort:** M (1–1.5 days). Independent of A–F.

### Phase H — Permissions / settings copy + reminder opt-in (XS)

The hard gate message "Your plan does not include calendar access." has no CTA. Add:
- An upgrade link that goes to `/(tabs)/settings` (web link copy: "Available on Coach Pro and up — open Settings → Upgrade.").
- Permission request flow: when the calendar tab first opens with `canAccessCalendar` true, prompt for notification permission with a one-line rationale. No surprise prompts later.

**Touch:** `apps/mobile/app/(tabs)/calendar.tsx`, `apps/mobile/app/settings.tsx` (already has an upgrade section).

**Effort:** XS (0.25 day).

### Phase I — Type duplication cleanup across web + mobile (S, follow-up)

Replace the 4 duplicate `CalendarEvent` declarations with the new shared type:
- `apps/web/src/app/calendar/page.tsx:8–25`
- `apps/web/src/app/coach-center/_lib/types.ts:68–79`
- `apps/web/src/app/doc-hub/_lib/types.ts:36–54`
- `apps/web/src/components/WeeklySummaryModal.tsx:12–37`

Web-only audit fields (`originalCoachId`, `assignedByUserId`, `reassignedBy`, `reassignedAt`) live in shared but are only used by DOC Hub; they remain optional on the shared type.

**Effort:** S (0.5 day). Independent.

---

## 2. Suggested execution order

| Phase | Description | Effort | Parallel? |
|---|---|---|---|
| A | Type consolidation | XS | Pre-req for everything |
| B | Read surface (month/week/agenda) | M | Standalone, ships first to users |
| C | Create / edit / detail | M | After B (reuses Toolbar) |
| D | Series scheduling dialog | S | Standalone, after C |
| E | Filter chips | S | After B |
| F | Reminder reliability | S | Standalone |
| G | Offline cache | M | Standalone |
| H | Permissions copy + reminder opt-in | XS | Standalone |
| I | Type cleanup across web | S | Standalone |

**Total: ~6–7 days of focused work.** Phases B and G can run in parallel (different developers if available). Everything else is sequential inside one branch.

Suggested PR shape:
- **PR 1**: Phase A + B + H (read surface, type lift, permissions copy). ~3 days. Ship behind a `?experimentalCalendar` flag for safe rollout, then remove the flag once stable.
- **PR 2**: Phase C + D + E + F (write surface, reminders). ~3 days.
- **PR 3**: Phase G + I (offline, web type cleanup). ~2 days.

---

## 3. Risks & open questions

### Risks
- **Performance.** Month view rendering 42 cells × up to 3 chips = 126 React nodes. Today `useCalendarEvents` fetches a single window; with prefetch of neighbours we'd add 2x cache. Mitigation: virtualise the month grid (skip out-of-month days after the first/last), memoise `EventChip`.
- **Conflict detection cost.** Refetching `/calendar/events` on every date/time keystroke (web's pattern) hits the API hard. Mitigation: debounce 300ms, and use the cached event list when available.
- **Edit-mode ambiguity.** The same `EventSheet` is used for create and edit. Fields like `title` (currently derived from session) need defaults so the detail view stays consistent.
- **Time zones.** All times are UTC ISO + `toLocaleString`. For Phase 1 we keep the existing behaviour (web parity), but the eventual solution is per-user `timeZone` — out of scope for mobile-only.
- **`teamId` vs `teamName`.** Backend accepts both; mobile currently uses free-text only. We won't introduce a `Team` picker on mobile in this plan (the web's `ScheduleSessionModal` doesn't have one either — it's also free-text).

### Open questions (need product input before Phase C lands)
1. Should "Create" allow **standalone events** (game, meeting, off-day) with no `sessionId`? Backend requires `sessionId`, so today the answer is no. If product wants standalone events, that's a backend change.
2. Should the calendar tab auto-jump to **Today** on every cold launch, or remember the last view/date?
3. Should cancelled events be **soft-recoverable** (toggle back to active) or only deletable?
4. Should the `+N more` overflow in month cells open a sheet listing all events for that day (web's UX) or expand inline?
5. Should reminder opt-in happen on first calendar-tab open (recommended) or only when the user taps "Schedule"?

---

## 4. Out of scope (explicitly)

These exist in web but are not in this plan. Each is a discrete follow-up.

- **Recurring events** — backend has no `rrule` support (`docs/CALENDAR_BACKEND_API.md:4`). Would need a schema migration.
- **iOS Calendar / EventKit sync** — never wired; `expo-calendar` not installed. Would require entitlements + Info.plist `NSCalendarsUsageDescription`.
- **Per-event timezone** — no schema column; backend stores UTC ISO. Would need migration.
- **DOC Hub mobile surface** — web's `/doc-hub/calendar` (multi-coach grid + assign/auto-populate/reassign) is intentionally web-only because it requires `ClubRole.DOC` / `SECTION_DIRECTOR` and coach-roster admin actions. Mobile coach accounts don't have these roles in normal flow; if a Super Admin needs the same flows on mobile we can port later.
- **Search across events** — not in web either. Could add a `title`/`notes`/`teamName`/`location` substring filter as a follow-up.
- **Drag-to-reschedule** — never in web. Big effort, low value on a 390pt viewport.
- **Calendar export (.ics)** — not in web. Backend has no export endpoint.

---

## 5. Day-by-day suggested schedule

| Day | Focus |
|---|---|
| Day 1 (Mon) | Phase A (type lift, ~2 hours) + start Phase B (Toolbar + MonthGrid skeleton) |
| Day 2 (Tue) | Finish Phase B (WeekStrip + DayAgenda + EventRow) |
| Day 3 (Wed) | Phase B polish + Phase E (FilterChips). Internal demo. |
| Day 4 (Thu) | Phase C (EventSheet + EventDetailSheet + ConflictBanner). Phase F reminder reliability in parallel. |
| Day 5 (Fri) | Phase C polish + Phase D (ScheduleSeriesSheet). Internal demo. |
| Day 6 (Mon) | Phase G (offline cache). |
| Day 7 (Tue) | Phase I (web type cleanup). Final QA + simulator pass. |

---

## 6. Definition of done

- All existing surfaces (Home "Up next", Vault badges, Coach Center) continue to work — no broken deep links.
- Users can: view month, view week, view agenda, drill into a day, open event detail, edit any field, cancel, delete, create from a session, mark complete/incomplete.
- Users see conflict warnings before they double-book (advisory, not blocking — matching web).
- Reminders fire for the right events with the right body text, and tapping a reminder opens the event detail.
- "Schedule all unscheduled" on a series doesn't double-schedule parts that already have events.
- Offline: previously-loaded calendar events remain readable; mutations still error gracefully.
- TypeScript clean, ESLint clean, simulator pass.
- Calendar tab badge count is debounced and consistent with `useReminderSync`.