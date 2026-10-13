# Mobile Calendar Inventory

**Repo:** `/Users/macbook/Projects/aci-mobile`
**Scope:** Every calendar-related file under `apps/mobile/`, plus the shared calendar type and every screen / entry point that schedules, edits, deletes, or surfaces a calendar event.
**Method:** Read end-to-end. Quoted line numbers reference the exact source files listed in §1.

---

## 1. File map

### 1a. Calendar surface (mobile-specific)

| Path | Role |
|---|---|
| `apps/mobile/app/(tabs)/calendar.tsx` | The `Calendar` tab itself: list, create-form, weekly-summary block, gate (`canAccessCalendar`). |
| `apps/mobile/services/calendar.service.ts` | All HTTP calls: list/create/update/delete events, weekly summary, vault calendar counts. Also exports the `CalendarEventItem` type. |
| `apps/mobile/components/calendar/ScheduleSessionSheet.tsx` | Reusable `Modal` sheet (date + time + duration input) reused from Session Result, Vault session detail, etc. |
| `apps/mobile/utils/calendar-badge.ts` | Pure helper `countEventsForTodayAndTomorrow(events, now)` used for app-icon badge + dashboard home card. |

### 1b. Shared types

| Path | Role |
|---|---|
| `packages/shared/src/types/calendar.ts` | The single shared `CalendarEvent` interface (`id`, `title?`, `startAt?`, `endAt?`, `date?`, `time?`). Re-exported via `packages/shared/src/index.ts` (line 3). |
| `packages/shared/src/types/auth.ts` | Defines `UserFeatures.canAccessCalendar` (line 12) and `UserFeatures.canGenerateWeeklySummaries` (line 14). |

### 1c. Surfaces that consume / mutate calendar events

| Path | Calendar touch |
|---|---|
| `apps/mobile/app/(tabs)/index.tsx` | Home: "Up next" event card (next upcoming event) + "Upcoming events" list of the remaining events. Uses `getUpcomingEvents`. Both blocks gated on `canAccessCalendar`. |
| `apps/mobile/components/dashboard/UpcomingEventItem.tsx` | Compact row used in the home "Upcoming events" list. Reads `event.title` and `event.startAt \|\| event.date` only. |
| `apps/mobile/components/dashboard/QuickActionGrid.tsx` | The Calendar quick action is rendered only if `canAccessCalendar` is true (lines 50-55). |
| `apps/mobile/app/(tabs)/vault.tsx` | Vault tab: pulls `getVaultCalendarEvents` to compute per-session/per-series "On calendar" badges, "scheduled parts" pills, and a `Load More` button that increments offset. |
| `apps/mobile/components/vault/VaultCards.tsx` | Renders the `CalendarBadge` ("On calendar · N") on session cards and `X/Y scheduled` pill on series cards. |
| `apps/mobile/app/vault/series/[seriesId].tsx` | Series detail: shows how many parts are on the calendar, a "Schedule all N unscheduled" button that creates weekly Wednesday-6pm events, plus long-press → open session alert. |
| `apps/mobile/app/vault/session/[sessionId].tsx` | Vault session detail: opens `ScheduleSessionSheet`, shows already-scheduled banner + next-event label. |
| `apps/mobile/app/session/result.tsx` | Generated session result: opens `ScheduleSessionSheet`, posts via `createCalendarEvent`. |
| `apps/mobile/app/coach-center/[teamId]/index.tsx` | Team overview: "Upcoming sessions" list (Coach Center) — uses `updateCalendarEvent({ completed: true })`. |
| `apps/mobile/app/coach-center/[teamId]/week.tsx` | Coach Center team-week calendar: prev / this / next week navigation, day-cards with `Mark done` action (`updateCalendarEvent`). |
| `apps/mobile/services/coach-center.service.ts` | `getTeamWeekCalendar(teamId, weekStart)` returns the team-specific grouped shape used by the Coach Center week screen. |
| `apps/mobile/hooks/useReminderSync.ts` | Global reminder sync: re-pulls calendar events on login / reconnect / toggle changes and rebuilds local notifications. |
| `apps/mobile/services/notifications.service.ts` | All local-notification scheduling for sessions (1h before, day before) + weekly-summary reminder. Persists event↔notification id map in AsyncStorage. |
| `apps/mobile/stores/notifications.store.ts` | Persisted Zustand store for the two notification toggles (`sessionRemindersEnabled`, `weeklySummaryEnabled`). |
| `apps/mobile/components/notifications/NotificationSettings.tsx` | Toggles in the Notifications screen. |
| `apps/mobile/app/notifications/index.tsx` | Notifications screen hosting `NotificationSettings` + permission request button. |
| `apps/mobile/app/_layout.tsx` | Mounts `useReminderSync()` (line 24). |
| `apps/mobile/app/(tabs)/_layout.tsx` | Renders the bottom-tab "Calendar" entry (`Ionicons calendar-outline`). |
| `apps/mobile/components/offline/NetworkBanner.tsx` | Yellow offline banner; nothing calendar-specific but shown above the calendar tab when offline. |
| `apps/mobile/services/offline-cache.service.ts` | Caches vault sessions, **not** calendar events (the calendar has no offline cache). |
| `apps/mobile/services/session.service.ts` | `saveSessionToVault(sessionId)` — no calendar side effect. |
| `apps/mobile/services/drill.service.ts` | Drill generation only — no calendar side effect. |
| `apps/mobile/services/auth.service.ts` | Auth-only — no calendar side effect. |
| `apps/mobile/stores/auth.store.ts` | Wraps user with `features.canAccessCalendar`. |
| `apps/mobile/hooks/useAuth.ts`, `hooks/useNetworkStatus.ts` | Hooks re-used by the calendar tab. |
| `apps/mobile/services/api.ts` | Axios client + `normalizeApiError` reused by every calendar call. |
| `apps/mobile/services/network.service.ts` | `NetInfo` wrapper feeding `isOnline` used to disable calendar queries. |

### 1d. Things that reference calendar types but aren't calendar code

- `apps/web` and `apps/api` both consume `@aci/shared`'s `CalendarEvent`. Not part of mobile, but it explains why `calendar.ts` only defines the minimal shape.

---

## 2. Current screen structure

### 2.1 Bottom-tab entry

`apps/mobile/app/(tabs)/_layout.tsx:57-66` registers `calendar` as the 5th bottom tab with the `Ionicons calendar / calendar-outline` icon and label "Calendar".

### 2.2 Calendar tab — `apps/mobile/app/(tabs)/calendar.tsx`

Top-to-bottom the screen is one `ScrollView` containing a title ("Calendar"), a subtitle whose copy depends on `useNetworkStatus().isOnline` (lines 201-205), then three `View`s (line 207 "Create event", line 297 "Weekly summary" if available, line 304 "Upcoming events"). There is **no separate route** for editing or viewing a single event; editing lives inline on the event row, and the only creation surface is the form on the same screen.

**Hard gate:** `if (!user?.features.canAccessCalendar) return ... ` (lines 118-127) — when the flag is off the screen renders `title + "Your plan does not include calendar access."` and nothing else. No alternative CTA, no upgrade link.

**Two tabs / lists / filters / FABs / modals actually present:**
- Tabs: none.
- Lists: exactly one flat "Upcoming events" block (line 304) with rows defined inline at lines 306-346 — no grouping by date, no header for each day, no section list, no infinite scroll.
- Filters: none. The only filter anywhere is the local `sessionPickerQuery` text inside the create form, which filters the recent-sessions picker (not the event list).
- FAB: none.
- Modals: none. The create form is embedded inline; date/time inputs use the system `DateTimePicker` directly.
- Pull-to-refresh: none on the calendar screen specifically; `eventsQuery.refetch()` is called manually after create/delete/complete (lines 175, 191, 332).

**Create form fields (all on the same screen, lines 207-295):**
- "Vault session" — text input with a live-filtered recent-sessions list (max 8). Picks a `sessionId` (lines 209-243).
- "Date & time" — read-only preview plus, on Android, two buttons to open date and time pickers. On iOS the compact inline pickers are always shown (lines 245-289).
- "Duration (minutes)" — text input (default `'60'`) (line 291).
- "Notes" — text input (default `''`) (line 292).
- Submit button labeled "Schedule" (line 294).

There is **no team picker, location field, or recurring option in the create form**, despite the `CalendarEventItem` type and the `createCalendarEvent` payload both accepting `location`/`teamName` (see §5). The calendar tab never sends `location` and never sends `teamName`.

**Weekly summary block (lines 297-302)** — only rendered when `user.features.canGenerateWeeklySummaries` is true. Shows the plain-text response of `getWeeklySummary(weekStart, weekEnd)` (no styling beyond a single `Text`).

**Upcoming events list (lines 304-348)** — renders every item returned by `getCalendarEventsInRange(range.start, range.end)` (range = today → today + 30 days, lines 84-89). Each row shows:
- Title (line 310): `event.session?.title || event.title || event.teamName || event.location || 'Training event'` — a chained fallback across fields that the API may or may not return.
- Time (line 312): formatted via the local `formatDate(event.scheduledDate || event.startAt || event.date)`.
- 📍 location (line 313), 👥 team (line 314), conditionally.
- If `event.sessionId` is truthy: a `Start practice` button that deep-links to `/sideline/[sessionId]` (lines 315-326).
- A `Mark complete` / `Mark incomplete` toggle that calls `updateCalendarEvent(event.id, { completed: !event.completed })` (lines 327-340).
- A `Delete` action (line 342) handled by the `onDelete` function (lines 183-195): first `cancelEventReminders(eventId)` (clears any pending local notifications), then `deleteCalendarEvent`, then refetch.

**Empty state (line 347)**: "No upcoming events."

**Hard-coded styling:** `colors.background`, `colors.surface`, `colors.primary`, `colors.danger`, `colors.muted`. No light-mode variant.

### 2.3 `ScheduleSessionSheet` — `apps/mobile/components/calendar/ScheduleSessionSheet.tsx`

`Modal` with `animationType="slide" transparent`. Black translucent `backdrop` plus a bottom-rounded card. Props (lines 8-16):

- `visible: boolean`
- `title?: string` (default `'Schedule session'`)
- `initialDate?: Date`
- `durationMin?: number` (default `60`)
- `onCancel: () => void`
- `onConfirm: (payload: { scheduledAt: Date; durationMin: number }) => void`
- `loading?: boolean`

Initial values when no `initialDate` is provided: tomorrow at 16:00 local (lines 38-43). On iOS both compact pickers are always mounted; on Android two secondary `Button`s toggle them (lines 55-60). Confirm clamps the duration to a minimum of `15` minutes (line 104): `Math.max(15, Number(duration) || durationMin || 60)`.

The sheet does **not** include team, location, or notes inputs. It also doesn't accept an existing event to edit — every caller either creates a new event or passes `loading` to show a spinner during the POST.

### 2.4 Generated-session result — `apps/mobile/app/session/result.tsx`

After `generateSession` completes, this screen shows the produced session and exposes a row of action buttons. Calendar-related buttons (lines 217-238):

- `Save to Vault` (line 217) — vault only, no calendar effect.
- `Share PDF` (line 218) — unrelated.
- `Favorite` (line 219) — unrelated.
- `Schedule…` (line 220-225) — opens `ScheduleSessionSheet`. Disabled when the session has no `id` or when `user.features.canAccessCalendar` is false. On confirm, `onScheduleConfirm` (lines 65-83) calls `createCalendarEvent({ sessionId, scheduledDate: payload.scheduledAt.toISOString(), durationMin, notes: session.title })`. Note that `notes` is hard-coded to the session title here — there's no real "notes" concept.
- `Create player plan` (line 226-232) — unrelated to calendar.
- `Share ref` (line 233) — share sheet; unrelated.
- `Sideline Mode` (line 234-238) — unrelated.

### 2.5 Vault session detail — `apps/mobile/app/vault/session/[sessionId].tsx`

Pulls the session via `getVaultSession`, plus `getVaultCalendarEvents` (line 38) so it can show how many times this session is scheduled. Lines 48-70 derive `scheduledForSession = calendar events for this session, sorted by date`; line 56-70 compute a "next" label from the nearest event >= now.

Renders (lines 150-243):
- A blue "Already on your calendar" banner (lines 161-174) when at least one event exists for the session, deep-linking back to `/(tabs)/calendar`.
- The drill list and `StoredDrillDiagram`.
- Action buttons: `Sideline Mode`, `Share PDF` (if `canExportPDF`), `Schedule…`/`Schedule again…` (if `canAccessCalendar`), `Create player plan` (if `canCreatePlayerPlans`).
- A blue "More actions are available on higher plans…" hint if any feature flag is off (lines 236-242).

`ScheduleSessionSheet` is mounted here too (lines 245-251); its confirm handler calls `createCalendarEvent` then `queryClient.invalidateQueries({ queryKey: ['vault', 'calendar-counts'] })` (lines 96-113).

### 2.6 Vault series detail — `apps/mobile/app/vault/series/[seriesId].tsx`

Loads `getVaultSeries` and `getVaultCalendarEvents` (line 55-60). Two derived views:
- `scheduledParts` (line 93): count of sessions with ≥ 1 calendar event.
- `unscheduledParts` (line 94): sessions with 0 events.

Renders (lines 141-211):
- Blue "On your calendar — N of M sessions already scheduled" banner when `scheduledParts > 0` (lines 154-161).
- `Schedule all N unscheduled` button (line 166) calling `onScheduleAll` (lines 96-124). That function posts one event per unscheduled part with weekly Wednesday-at-6pm cadence (`nextWeekdayAt(now, 3, 18, 0)` + 7-day step, lines 102-113). The label is hard-coded to `WEEKDAYS[3]` = "Wed" and `6:00 PM` — no UI to pick a different day/time/interval.
- A flat list of session cards (lines 178-208). Each card shows an "On calendar" pill if it's already scheduled (lines 195-199). Long-pressing fires `onScheduleOne(session)` which `Alert.alert`'s "Schedule session?" and routes to the session detail (`/vault/session/[sessionId]`) — i.e. calendar creation always happens on the session detail screen.

### 2.7 Home dashboard — `apps/mobile/app/(tabs)/index.tsx`

Two calendar-driven tiles:
- "Up next" big card (lines 112-139): only the `nextEvent = upcomingEventsQuery.data?.[0]`. Tapping routes to `/(tabs)/calendar`. Shows `nextEvent.title || nextEvent.teamName || 'Training event'` plus a `toLocaleString` of `nextEvent.scheduledDate || nextEvent.startAt`.
- "Upcoming events" list (lines 205-218): rendered only when `canAccessCalendar` is true. Shows `upcomingEventsQuery.data.slice(1)` (everything past the "next" event, capped at the query's `limit=2` total) via `UpcomingEventItem`.

`getUpcomingEvents(limit=2)` (services line 16): hits `/calendar/events` with a `now` → `now+30 days` window. So the home is effectively limited to *two* upcoming events.

`UpcomingEventItem` (`apps/mobile/components/dashboard/UpcomingEventItem.tsx`) is a one-row component: title + one-line date. No actions, no deep-link.

### 2.8 Coach Center — `apps/mobile/app/coach-center/[teamId]/index.tsx` and `week.tsx`

These are coach-center specific calendars (team-scoped). They use the dedicated `/coach-center/teams/:id/overview` and `/coach-center/teams/:id/calendar` endpoints (see `services/coach-center.service.ts:120-158`), **not** `/calendar/events` directly. They render a different `CoachCenterWeekDay[]` shape: each day has `date`, `dayLabel`, and `events: { id, time, location, completed, forThisTeam, session }[]`.

Week screen (`week.tsx`):
- Prev / This week / Next nav (lines 71-75).
- Day-cards (lines 77-137). Each event shows time, session title, optional location, and three text links: `Sideline`, `Session`, and `Mark done` (calls `updateCalendarEvent(eventId, { completed: true })` at line 36-37).

Team overview screen (`index.tsx`):
- "Upcoming sessions" card (lines 109-160). Same `Mark done` pattern via `updateCalendarEvent` (line 58).

### 2.9 Notification permission + weekly summary reminder

- `useReminderSync` (`apps/mobile/hooks/useReminderSync.ts`) is mounted once in `app/_layout.tsx:24` and runs whenever the user is authenticated & `canAccessCalendar` & `isOnline` (lines 27). It pulls the next-30-days events and calls `resyncSessionReminders` to (a) cancel any notifications for events no longer in the list and (b) schedule 1h-before and day-before notifications for every active event when `sessionRemindersEnabled` is on. It also schedules or cancels the weekly-summary weekly notification (Monday 08:00 local) and sets the app-icon badge count to `countEventsForTodayAndTomorrow`.
- `apps/mobile/app/(tabs)/calendar.tsx:80-101` calls `setBadgeCount(0)` on mount and again from a `useEffect` keyed on `eventsQuery.data` (line 97-101) — so opening the calendar zeros the badge.
- `apps/mobile/components/notifications/NotificationSettings.tsx` exposes the two `sessionRemindersEnabled` / `weeklySummaryEnabled` toggles used by store and reminder sync. Defaults: both `true`.

### 2.10 Vault tab badges

`apps/mobile/app/(tabs)/vault.tsx:166-176` reads `getVaultCalendarEvents` (staleTime 60s) and computes `sessionCalendarCounts` / `seriesCalendarStats`. The session list and series list each render a `CalendarBadge` pill via `SessionCard` / `SeriesCard` in `components/vault/VaultCards.tsx:75-82, 211-215`.

---

## 3. Capabilities (what works today)

### 3.1 Feature access

- `canAccessCalendar` gates:
  - The `Calendar` tab body (`calendar.tsx:118`).
  - The home "Upcoming events" card (`index.tsx:205`).
  - The "Up next" green hero card on home (`index.tsx:112`).
  - The `Calendar` quick action in the dashboard (`QuickActionGrid.tsx:50-55`).
  - The `Schedule` button on generated session results (`session/result.tsx:223`).
  - The `Schedule…` button on vault session detail (`vault/session/[sessionId].tsx:221`).
  - The `Schedule all N unscheduled` button on series detail (`vault/series/[seriesId].tsx:163`).
  - All calendar queries inside vault tabs (`vault.tsx:169, series/[seriesId].tsx:58, vault/session/[sessionId].tsx:41`).
  - The reminder sync hook (`useReminderSync.ts:27`).
- `canGenerateWeeklySummaries` gates the weekly-summary block on the calendar tab only.

### 3.2 Read

- **Range list** of events — `getCalendarEventsInRange(startDate, endDate)` calling `GET /calendar/events?startDate=&endDate=` (`calendar.service.ts:35-44`). The mobile uses two windows: today → +30 days for the tab, today-2m → +6m for vault badge counts.
- **Upcoming (capped)** — `getUpcomingEvents(limit=2)` from the same endpoint, used by Home (`calendar.service.ts:16-33`).
- **Vault window** — `getVaultCalendarEvents()` (`calendar.service.ts:46-64`): active (non-cancelled) events in a 2-month-prior → 6-month-forward window; used by Vault tab, Vault session detail, Vault series detail.
- **Weekly summary** — `getWeeklySummary(weekStart, weekEnd)` calling `GET /calendar/weekly-summary` (`calendar.service.ts:122-131`). Returns `{ summary, text }`. Mobile only renders `text`.

### 3.3 Create

- Single canonical path: `createCalendarEvent({ sessionId, scheduledDate, durationMin?, notes?, location?, teamName? })` → `POST /calendar/events` (`calendar.service.ts:75-89`).
- Required: `sessionId`, `scheduledDate` ISO-8601 string.
- Callers:
  - `calendar.tsx` create form (lines 158-163).
  - `session/result.tsx` via `ScheduleSessionSheet` (lines 70-75).
  - `vault/session/[sessionId].tsx` via `ScheduleSessionSheet` (lines 96-113).
  - `vault/series/[seriesId].tsx` "Schedule all" loop (lines 108-112).
- After a successful POST the calendar tab refetches (`eventsQuery.refetch()`); the vault session detail invalidates `['vault', 'calendar-counts']`.

### 3.4 Update

`updateCalendarEvent(eventId, { scheduledDate?, durationMin?, notes?, location?, teamName?, completed?, cancelled? })` → `PATCH /calendar/events/:eventId` (`calendar.service.ts:91-112`). Mobile callers only ever set `completed`:

- `calendar.tsx:331` — toggle on calendar tab rows.
- `coach-center/[teamId]/index.tsx:58` — `Mark done` from team overview.
- `coach-center/[teamId]/week.tsx:36` — `Mark done` from the day view.

The form payload allows rescheduling, renaming, etc., but no mobile screen actually exposes those fields — i.e. the spec is supported server-side but the UI can only flip `completed`.

### 3.5 Delete

`deleteCalendarEvent(eventId)` → `DELETE /calendar/events/:eventId` (`calendar.service.ts:114-120`). Only invoked from the calendar tab's row-level `Delete` link (`calendar.tsx:183-195`), which cancels local notifications first via `cancelEventReminders`.

### 3.6 Notifications

- Two notification kinds are scheduled via Expo Notifications (`apps/mobile/services/notifications.service.ts`):
  - **Session reminders**: 24h-before and 1h-before local notifications per event. Body uses `event.title` (defaulted to `'Training Session'` in `useReminderSync`). Channel `session-reminders` on Android only (lines 27-33).
  - **Weekly summary reminder**: every Monday 08:00 local, body "Open Calendar to review this week's plan." (`scheduleWeeklySummaryReminder`, lines 174-199).
- Persistence: an `EventMap` of `eventId → notificationId[]` stored at `notif:event-map-v1` in AsyncStorage (lines 5-7, 50-63). Also per-event raw identifier arrays at `notif:event:<id>` (line 130).
- Listener handler at module load (lines 10-17): every foreground notification plays sound, shows banner, sets badge, adds to list.
- Permission flow: `requestNotificationPermission()` (lines 35-41) checks current state then calls `requestPermissionsAsync` only if not already granted. The calendar tab's `onCreateEvent` calls it after a successful event creation (lines 165-172).
- Sync triggers in `useReminderSync`: `isAuthenticated`, `user.features.canAccessCalendar`, `isOnline`, and the two notification toggles (`useReminderSync.ts:73-79`). It skips if a sync is already running (`syncing.current`, lines 32-33). If permissions aren't granted the hook disables the weekly reminder and zeros the badge.

### 3.7 iOS Calendar sync

None. No `expo-calendar`, `EventKit`, `CalendarKit`, `RRULE`, `recurrence`, `recurring`, `startAt`, or `endAt` references in the repo (`Grep` confirmed). The README proposes `expo-calendar` as the implementation target (`docs/mobile/README.md:66`) but it's never installed.

### 3.8 Offline behavior

- All calendar queries are gated on `isOnline`:
  - `calendar.tsx:94` (`eventsQuery.enabled`).
  - `vault.tsx:169` and `series/[seriesId].tsx:58`, `vault/session/[sessionId].tsx:41` (`calendarQuery.enabled`).
- `getUpcomingEvents` is hard-gated to `isAuthenticated && canAccessCalendar` in `index.tsx:48` and uses `enabled: isAuthenticated`, so no offline events on home.
- **There is no offline cache of calendar events** — only vault sessions are cached (`services/offline-cache.service.ts`).
- When offline:
  - The calendar tab shows subtitle "Calendar updates require an internet connection." (line 204) and `onCreateEvent` errors out with "Calendar scheduling requires an internet connection." (line 146). `onDelete` errors with "Calendar updates require an internet connection." (line 186).
  - The "Upcoming events" block has no data, no error UI, no pull-to-refresh.
- `useReminderSync` skips entirely when offline, so the badge stays from the last online snapshot (lines 26-28).

---

## 4. Gaps & rough edges

### 4.1 No edit mode / no event detail screen

- `docs/mobile/PHASE_5.md:74-113` specifies a dedicated `calendar/event/[eventId].tsx` route with a month grid, day picker, edit/delete modal. None of that exists; the mobile ships a single flat list (`calendar.tsx:304-348`).
- `updateCalendarEvent` accepts `scheduledDate`, `durationMin`, `notes`, `location`, `teamName`, `cancelled`, but the mobile exposes only `completed`. Reschedule / re-time / add notes all have to happen on another surface (web only).

### 4.2 Inline create form is awkward

- The "Vault session" picker at `calendar.tsx:215-238` is just a free-text filter against the 25 most recent vault sessions (no paging, no age-group filter, no team filter). If the user wants to schedule a session that's not in the recent list they have to go to `/vault/session/:id` first.
- No team picker exists anywhere on mobile. `createCalendarEvent` allows `teamName` and `location` (`calendar.service.ts:80-81`) but the form ignores both fields.
- `session/result.tsx:74` sets `notes: session?.title` — a misuse; sessions already have a `title`, so `notes` becomes a duplicate. There is no notes UI anywhere.
- `ScheduleSessionSheet` clamps duration to a minimum of 15 minutes, but the inline calendar tab form does not (`Number(durationMin) || undefined` — passes whatever the user types).

### 4.3 List rendering

- No grouping by date or section list. Events render as a flat row list with no day separators.
- No infinite scroll. The calendar tab fetches a hard 30-day window at mount and only refetches after explicit mutations.
- No pull-to-refresh on the calendar tab (only on Home, Vault, Coach Center, Settings).
- Title resolution falls through a chain `event.session?.title || event.title || event.teamName || event.location || 'Training event'` (`calendar.tsx:310`). Combined with the fact that no caller sends `title`, `teamName`, or `location`, the row label is usually `event.session?.title` — which is whatever the backend hydrates — and otherwise "Training event". This means the inline data falls back silently instead of asking the user to set them.

### 4.4 Permissions & offline messaging

- The "Your plan does not include calendar access." gate (lines 118-127) has no follow-up CTA — no "Upgrade on the web" link, no contact info. The other gates (vault session detail) do point users to web (`vault/session/[sessionId].tsx:239-242`).
- When offline the screen provides no fallback list — it just says no internet. The Vault tab in the same situation reads from `OfflineEmptyState` and an offline session cache (`vault.tsx:444, 220-230`); the calendar tab has no equivalent.

### 4.5 No team-grouped scope

- `getTeamWeekCalendar` in `coach-center.service.ts:137-158` returns events grouped by day scoped to one team, but the calendar tab and Home dashboard always use the unscoped `/calendar/events` endpoint. A coach with multiple teams has no way to filter the calendar to a single team in mobile.

### 4.6 Notification reliability

- `setBadgeCount` is called from two places with no debouncing: (a) `useReminderSync` after the next-30-days fetch, (b) `calendar.tsx:80-101` on mount and on every events-query update. So opening the calendar tab can change the badge to 0 (line 81: `setBadgeCount(0)` on mount) and then back to today's count when the data resolves. Not strictly broken, but inconsistent.
- `scheduleSessionReminders` uses `event.title` for the body (`notifications.service.ts:99, 115`). On mobile this is hard-coded to "Training Session" because no caller passes a `title` (events are auto-derived). `useReminderSync` substitutes `event.teamName || event.location` (`useReminderSync.ts:52`) when re-syncing, but for events scheduled *inside* the calendar tab the title is fixed at "Training Session" (`calendar.tsx:169`).
- Cancelled events: `updateCalendarEvent` supports `cancelled: true` but no mobile surface toggles it. The only way to remove an event is `deleteCalendarEvent`.
- Tapping a notification does not route anywhere; no handler exists for `notification.response` (`Grep` confirmed). The data payload is set (`data: { eventId, kind: 'day_before' | 'hour_before' }`), but nothing reads it.

### 4.7 Type duplications and ambiguities

- The shared type `CalendarEvent` (`packages/shared/src/types/calendar.ts`) defines **only** `id`, `title?`, `startAt?`, `endAt?`, `date?`, `time?`.
- The mobile locally extends it with seven extra fields: `sessionId?, scheduledDate?, durationMin?, notes?, location?, teamName?, completed?, cancelled?` (`calendar.service.ts:4-14`).
- Several components type their event as `CalendarEvent` (e.g. `UpcomingEventItem.tsx:1` reads `event.startAt || event.date`) but the runtime data actually carries `scheduledDate`. `UpcomingEventItem` silently shows `TBD` or the raw ISO string because the helper only handles `event.startAt || event.date` (`UpcomingEventItem.tsx:9-22`). In practice the home dashboard falls back to `new Date(nextEvent.scheduledDate || nextEvent.startAt || '')` in `index.tsx:130`, which is fine — but `UpcomingEventItem`'s formatter is dead-code for the new payload.
- `event.session?: { id, title, refCode, durationMin }` shape is implicit and used in `calendar.tsx:310`, `coach-center/[teamId]/index.tsx:40`, and `week.tsx:74`. Not declared anywhere except via the coach-center service types — the calendar service treats `session` as optional and untyped (`getCalendarEventsInRange` just returns the raw list).

### 4.8 "Schedule all" UX is opinionated

`vault/series/[seriesId].tsx:96-124` hard-codes:
- Day of the week: Wednesday (`WEEKDAYS[3]`, line 32).
- Time: 18:00 local.
- Step: every 7 days starting "next Wednesday".
- Label: "Weekly on Wednesdays at 6:00 PM, starting next Wednesday."

There is no UI to override any of this. If a series has parts already on a different cadence, the schedule-all still anchors to the next Wednesday — which can collide with existing events.

### 4.9 No recurring events

- No `recurrence` / `RRULE` / `repeat` flag exists in the codebase.
- Series-level scheduling is one-shot per part: `createCalendarEvent` is called in a loop, not via a server-side series. The schedule-all button at line 108-112 deletes nothing — if the user runs it twice they get duplicate events.

### 4.10 iOS Calendar (EventKit) sync — never wired

- `app.json` lists only `expo-router` and `expo-secure-store` plugins (lines 15-18). `expo-calendar` is not installed; there's no `NSCalendarsUsageDescription` key.
- No code anywhere imports `expo-calendar` or `EventKit`.

### 4.11 Misc inconsistencies

- `setWeeklySummaryEnabled(false)` won't actually disable scheduled reminders if `notif:weekly-summary-id` was never stored — `scheduleWeeklySummaryReminder(false)` only cancels what it finds (lines 176-180). On a fresh install with the toggle off the weekly reminder is never scheduled.
- `ScheduleSessionSheet` ignores `initialDate` if it's a falsy value (line 38: `if (initialDate) return initialDate;`), but always falls through to "tomorrow at 16:00" — fine, but worth noting that the prop's semantics differ from `calendar.tsx`'s own default ("next hour, top-of-the-hour", `calendar.tsx:67-72`).
- The session-result screen sends `notes: session?.title` to `createCalendarEvent` (line 74). That string is then echoed back as `event.notes`. The mobile never displays `event.notes` anywhere (`Grep` confirms). So notes is dead-end data on mobile.
- `onCreateEvent` does *not* call `invalidateQueries`. It only does `eventsQuery.refetch()` (line 175). Other screens (`vault/session/[sessionId].tsx:107`, `vault/series/[seriesId].tsx:118`) do call `queryClient.invalidateQueries` — so post-create lists are briefly stale on the calendar tab until a manual refresh.
- `useReminderSync` swallows all errors with a bare `catch {}` (line 62). It logs nothing, so a misbehaving event silently disappears from reminders.

---

## 5. Type summary

| Type | Defined in | Field shape (selected) | Used in mobile by |
|---|---|---|---|
| `CalendarEvent` (shared) | `packages/shared/src/types/calendar.ts` | `id: string; title?: string; startAt?: string; endAt?: string; date?: string; time?: string` | Imported as a *type only* in `services/calendar.service.ts:1`, `components/dashboard/UpcomingEventItem.tsx:1`. Re-exported via `packages/shared/src/index.ts:3`. The shared shape is a thin envelope and is **not** what the mobile's runtime data looks like. |
| `CalendarEventItem` (mobile) | `apps/mobile/services/calendar.service.ts:4-14` | `CalendarEvent & { id; sessionId?; scheduledDate?; durationMin?; notes?; location?; teamName?; completed?: boolean; cancelled?: boolean }` | Returned by every calendar service function; consumed by `app/(tabs)/calendar.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/vault.tsx`, `app/vault/series/[seriesId].tsx`, `app/vault/session/[sessionId].tsx`, `hooks/useReminderSync.ts`, `utils/calendar-badge.ts`. |
| `createCalendarEvent` payload | `apps/mobile/services/calendar.service.ts:75-82` | `{ sessionId; scheduledDate; durationMin?; notes?; location?; teamName? }` — all but `sessionId`/`scheduledDate` optional | Every mobile create path. |
| `updateCalendarEvent` payload | `apps/mobile/services/calendar.service.ts:91-101` | `{ scheduledDate?; durationMin?; notes?; location?; teamName?; completed?; cancelled? }` | Mobile only ever sets `completed`. |
| `getUpcomingEvents(limit)` | `services/calendar.service.ts:16` | Returns `CalendarEventItem[]`. Hits `/calendar/events?startDate=&endDate=` with today → today+30 days, sliced to `limit`. | `app/(tabs)/index.tsx:15`. |
| `getCalendarEventsInRange(startDate, endDate)` | `services/calendar.service.ts:35` | Returns `CalendarEventItem[]`. Same endpoint with custom window. | `app/(tabs)/calendar.tsx:15`, `hooks/useReminderSync.ts:5`. |
| `getVaultCalendarEvents()` | `services/calendar.service.ts:47` | Returns non-cancelled `CalendarEventItem[]` from a 2 months ago → +6 months window, with `includeCancelled=false`. | `app/(tabs)/vault.tsx:16`, `app/vault/series/[seriesId].tsx:11`, `app/vault/session/[sessionId].tsx:13`. |
| `countEventsBySessionId(events)` | `services/calendar.service.ts:66-73` | Returns `Record<sessionId, count>` (skips events without `sessionId` or with `cancelled`). | Vault tab badges, vault session-detail banner. |
| `countEventsForTodayAndTomorrow(events, now)` | `utils/calendar-badge.ts:1-12` | Returns the number of events scheduled between `now` and end-of-tomorrow. Reads `event.scheduledDate \|\| event.startAt \|\| event.date`. | `app/(tabs)/calendar.tsx:27, 99` and `hooks/useReminderSync.ts:13, 61`. |
| `getWeeklySummary(weekStart, weekEnd)` | `services/calendar.service.ts:122` | Returns `{ summary: any; text: string }`. `GET /calendar/weekly-summary`. | `app/(tabs)/calendar.tsx:16, 107`. |
| `UserFeatures.canAccessCalendar` | `packages/shared/src/types/auth.ts:12` | `boolean` | Every gate described in §3.1. |
| `UserFeatures.canGenerateWeeklySummaries` | `packages/shared/src/types/auth.ts:14` | `boolean` | `app/(tabs)/calendar.tsx:109, 297`. |
| `ScheduleSessionSheet` Props | `components/calendar/ScheduleSessionSheet.tsx:8-16` | `visible; title?; initialDate?; durationMin?; onCancel; onConfirm: (payload: { scheduledAt: Date; durationMin: number }) => void; loading?` | `app/session/result.tsx:241-247`, `app/vault/session/[sessionId].tsx:245-251`. |
| `CoachCenterWeekDay.events[]` | `services/coach-center.service.ts:65-76` | `{ id; time; location?; completed?; forThisTeam?; session?: { id; title?; refCode?; durationMin? } \| null }` | Only used by `coach-center/[teamId]/week.tsx`. |
| `CoachCenterOverview.upcoming[]`, `.recent[]` | `services/coach-center.service.ts:33-63` | `{ id; scheduledDate; location?; completed?; session?: { id; title?; refCode?; durationMin? } }` | Only used by `coach-center/[teamId]/index.tsx`. |
| `useNotificationsStore` state | `stores/notifications.store.ts:5-10` | `{ sessionRemindersEnabled; weeklySummaryEnabled; setSessionRemindersEnabled; setWeeklySummaryEnabled }` — persisted via AsyncStorage under `notifications-settings-v1` (lines 21-23). | `useReminderSync.ts`, `app/(tabs)/calendar.tsx:63`, `components/notifications/NotificationSettings.tsx`. |
| `Notifications.config.eventMap`, `weeklyId` storage keys | `services/notifications.service.ts:5-8` | `notif:event-map-v1`, `notif:weekly-summary-id`, plus ad-hoc `notif:event:<id>` for raw ids. | Internal to the service. |

---

## 6. Where to look next (entry points)

1. **API contract** — `apps/mobile/services/calendar.service.ts` (the 132 lines above are the entire mobile surface for `/calendar/events*`).
2. **Tab UI** — `apps/mobile/app/(tabs)/calendar.tsx` (only 466 lines).
3. **Reusable create sheet** — `apps/mobile/components/calendar/ScheduleSessionSheet.tsx` (141 lines).
4. **Reminder + badge plumbing** — `apps/mobile/hooks/useReminderSync.ts` and `apps/mobile/services/notifications.service.ts`.
5. **Spec gap** — `docs/mobile/PHASE_5.md:1-120` lays out a month/week view, event detail screen, edit modal, schedule-series modal — only `Calendar tab` (single flat list) and `ScheduleSessionSheet` currently ship.
