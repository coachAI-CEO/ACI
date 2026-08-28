# Calendar Backend API — Reference

This document captures the full surface area of the calendar/scheduling backend in `apps/api/`. The backend is a **Fastify/Express-style app** (Express `Router` + Prisma). All calendar data lives in a single Prisma table, `CalendarEvent`, with **no recurrence, no series expansion, and no multi-attendee support** — every event is one coach + one session at one wall-clock time. There is also a DOC Hub sub-API that lets a club DOC / Section Director assign, auto-populate, and reassign events onto coaches' calendars.

> All file references are relative to the repo root: `/Users/macbook/Projects/aci-mobile/`.

---

## 1. Prisma models

### 1.1 `CalendarEvent`

The only calendar table. Defined at `apps/api/prisma/schema.prisma:639–686`.

```55:82:apps/api/prisma/schema.prisma
// Calendar events - scheduled training sessions
model CalendarEvent {
  id            String   @id @default(uuid())
  userId        String   // CURRENT owner/executor -- whoever's calendar this shows on right now.
                          // Every existing query already filters on this field, so reassignment
                          // (below) only ever changes userId itself; no other read path needs to change.
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // What session is scheduled
  sessionId     String   // References Session.id
  sessionRefCode String? // For easy reference

  // When it's scheduled
  scheduledDate DateTime // Date and time of the training session
  durationMin   Int?     // Override session duration if needed

  // Additional context
  notes         String?  // Coach notes for this specific session
  location      String?  // Training location (field, facility, etc.)
  teamName      String?  // Which team/group this is for (legacy free-text)
  teamId        String?  @map("team_id")
  team          Team?    @relation(fields: [teamId], references: [id], onDelete: SetNull)

  // Status
  completed     Boolean  @default(false) // Mark as completed after session
  cancelled     Boolean  @default(false) // Mark as cancelled

  // Explicit reassignment/coverage trail (DOC Hub). originalCoachId is set
  // once, at creation, and never changes afterward -- it answers "whose
  // session was this originally," independent of who's covering it now.
  // assignedByUserId is who created this event, if it wasn't the coach
  // themself (a DOC/Section Director assigning a session onto a coach's
  // calendar). reassignedBy/reassignedAt record the most recent handoff.
  // All nullable: existing self-scheduled rows stay valid with no backfill.
  originalCoachId  String?   @map("original_coach_id")
  assignedByUserId String?   @map("assigned_by_user_id")
  reassignedBy     String?   @map("reassigned_by")
  reassignedAt     DateTime? @map("reassigned_at")

  // Metadata
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([userId])
  @@index([sessionId])
  @@index([scheduledDate])
  @@index([userId, scheduledDate])
  @@index([teamId])
}
```

Field-by-field:

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | `String @id @default(uuid())` | yes | Internal UUID. |
| `userId` | `String` | yes | **Current owner** of the event — who it shows on right now. Reassignment only flips this field (`schema.prisma:641–643`). |
| `user` | `User @relation` | yes | Implicit back-relation to `User`; `onDelete: Cascade`. |
| `sessionId` | `String` | yes | Plain string — **no `@relation` is declared**, so Prisma does not enforce FK integrity at the DB level. Service code verifies the session exists before insert (`services/calendar.ts:30–37`). |
| `sessionRefCode` | `String?` | no | Cached copy of `Session.refCode` for display. |
| `scheduledDate` | `DateTime` | yes | Single timestamp (start of session). There is no separate `endDate`. |
| `durationMin` | `Int?` | no | Optional override; falls back to `Session.durationMin || 60` (`services/calendar.ts:46`). |
| `notes` | `String?` | no | Free-text coach notes. |
| `location` | `String?` | no | Free-text. |
| `teamName` | `String?` | no | **Legacy free-text** field — see `teamId` below. |
| `teamId` | `String? @map("team_id")` | no | Real FK to `Team.id` (`Team @relation`, `onDelete: SetNull`). |
| `completed` | `Boolean @default(false)` | yes | Mark-as-done flag. |
| `cancelled` | `Boolean @default(false)` | yes | Soft-cancel flag. |
| `originalCoachId` | `String? @map("original_coach_id")` | no | Set once at creation; **never changes** during reassignment. Audit answer to "whose session was this originally?" (`schema.prisma:672`). |
| `assignedByUserId` | `String? @map("assigned_by_user_id")` | no | DOC/Section-Director who created the event when the coach didn't self-schedule (`schema.prisma:673`). |
| `reassignedBy` | `String? @map("reassigned_by")` | no | Most recent reassigner (`schema.prisma:674`). |
| `reassignedAt` | `DateTime? @map("reassigned_at")` | no | Timestamp of most recent reassign. |
| `createdAt` | `DateTime @default(now())` | yes | — |
| `updatedAt` | `DateTime @updatedAt` | yes | Auto-updated on Prisma `update()`. |

Relations:
- `user → User` — `User.calendarEvents: CalendarEvent[]` (`schema.prisma:492`). `onDelete: Cascade`.
- `team → Team` — `Team.calendarEvents: CalendarEvent[]` (`schema.prisma:891`). `onDelete: SetNull`.
- **No** explicit `Session` relation — `sessionId` is a plain string; integrity is enforced in service code, not the schema.

Indexes (`schema.prisma:681–685`):
- `CalendarEvent_userId_idx` (`userId`) — primary list filter for "this user's calendar."
- `CalendarEvent_sessionId_idx` (`sessionId`) — for the cleanup path in `routes-admin.ts:1854,2661` that deletes events when a session is deleted.
- `CalendarEvent_scheduledDate_idx` (`scheduledDate`) — for range scans.
- `CalendarEvent_userId_scheduledDate_idx` (composite) — backs the hot path `getCalendarEvents` (`services/calendar.ts:84–119`).
- `CalendarEvent_teamId_idx` (`teamId`) — used by the Coach Center team-calendar lookup (`services/coach-center.ts:1021`).

Created in migration `apps/api/prisma/migrations/20260124010128_add_calendar_events/migration.sql:1–34`. The reassignment trail fields (`originalCoachId` etc.) were added in a later migration — the initial table only had the four FKs and indexes shown above (`migration.sql:1–33`).

### 1.2 Adjacent models referenced by the calendar

These are not calendar tables, but the calendar endpoints touch them.

`Session` (`schema.prisma:192–254`):
- Holds the source training session. `sessionId` in `CalendarEvent` points here.
- Relevant fields: `refCode`, `title`, `durationMin`, `ageGroup`, `gameModelId`, `savedToVault`, `clubId`, `seriesId`, `seriesNumber`.
- Note: `sessionId` is a plain string in `CalendarEvent` (no Prisma relation), but `Session` has `qaReports`, `skillFocuses`, `user` (`@relation("GeneratedSessions")`), `club`. Deleting a `Session` does **not** cascade-delete `CalendarEvent` rows — admin routes do it manually (`routes-admin.ts:1854`).

`User` (`schema.prisma:433–502`):
- `User.calendarEvents: CalendarEvent[]` (`schema.prisma:492`).
- Has `role` (`UserRole` enum: `FREE, COACH, CLUB, ADMIN, TRIAL`), `subscriptionPlan`, `coachLevel` (none of these are calendar-specific but they gate the endpoints via `requireFeature`).

`Team` (`schema.prisma:870–898`):
- `Team.calendarEvents: CalendarEvent[]` (`schema.prisma:891`).
- `Team.coaches: TeamCoach[]` (`schema.prisma:887`) — DOC Hub uses `TeamCoach` to determine which coaches a DOC can manage (`services/club-calendar-assign.ts:47–58`).

`Club` (`schema.prisma:743–846`):
- Not directly related to `CalendarEvent`. Calendar events link to `Team`, which links to `Club` via `Team.clubId`.
- DOC Hub routes all take `:clubId` in the path (`routes-doc-hub.ts:359`).

---

## 2. Endpoints

All paths below are mounted at the **root** of the API (no prefix) via `app.use(calendarRoutes)` (`apps/api/src/app.ts:76`). Calendar routes are mounted **before** admin routes so the admin `requireAdmin` gate does not shadow them.

### 2.1 Endpoint summary

| # | Method | Path | Purpose | Paging |
|---|---|---|---|---|
| 2.1.1 | `POST` | `/calendar/events` | Coach creates one event on their own calendar | none |
| 2.1.2 | `GET` | `/calendar/events` | List the caller's events (with optional date/status filters and grouping) | none (returns all matches) |
| 2.1.3 | `GET` | `/calendar/events/:eventId` | Read a single event with full `session` joined | none |
| 2.1.4 | `PATCH` | `/calendar/events/:eventId` | Update an event's date/notes/location/etc. or mark completed/cancelled | none |
| 2.1.5 | `DELETE` | `/calendar/events/:eventId` | Hard-delete an event | none |
| 2.1.6 | `GET` | `/calendar/weekly-summary` | Aggregate events for parent communication; supports `?format=pdf` | none |
| 2.2.1 | `GET` | `/coach-center/teams/:teamId/calendar` | Read a coach's own events for a given team and week | none |
| 2.3.1 | `GET` | `/doc-hub/clubs/:clubId/calendar/week` | DOC view: Mon–Sun grid of all club coaches' events | none |
| 2.3.2 | `GET` | `/doc-hub/clubs/:clubId/vault/sessions` | Vault picker — sessions eligible to assign | `limit` query param |
| 2.3.3 | `POST` | `/doc-hub/clubs/:clubId/calendar/assign` | DOC assigns one vault session to one coach | none |
| 2.3.4 | `POST` | `/doc-hub/clubs/:clubId/calendar/auto-populate` | DOC fills Mon–Fri from vault sessions | none |
| 2.3.5 | `POST` | `/doc-hub/clubs/:clubId/calendar/reassign` | DOC moves an event to a substitute coach | none |

There is **no** `/calendar/upcoming` endpoint and **no** recurring-event expansion endpoint. Listing is the only way to get "upcoming"; clients filter client-side or pass `startDate`/`endDate`.

### 2.1 Self-calendar endpoints (`/calendar/*`)

All routes in `apps/api/src/routes-calendar.ts` go through `authenticate` (line 33) — i.e. any authenticated user — plus per-route `requireFeature('canAccessCalendar')` or `requireFeature('canGenerateWeeklySummaries')`. `requireFeature` is defined at `apps/api/src/middleware/auth.ts:187–214` and reads `SUBSCRIPTION_LIMITS[plan][feature]`. `ADMIN` role always bypasses (`middleware/auth.ts:195–197`). Plan gate is `apps/api/src/config/subscription-limits.ts`:

```100:107:apps/api/src/config/subscription-limits.ts
  "canAccessCalendar",
  "canCreatePlayerPlans",
  "canGenerateWeeklySummaries",
  "canInviteCoaches",
  "canManageOrganization",
] as const;
```

Plan → `canAccessCalendar` (`subscription-limits.ts:10–92`):

| Plan | `canAccessCalendar` |
|---|---|
| `FREE` | **false** |
| `COACH_BASIC` | true |
| `COACH_PRO` | true |
| `CLUB_STANDARD` | true |
| `CLUB_PREMIUM` | true |
| `TRIAL` | true |

Same matrix for `canGenerateWeeklySummaries` (`subscription-limits.ts:12, 27, 42, 57, 72, 87`).

The auth flow attaches `req.userId` (UUID), `req.userRole` (UserRole enum string), `req.user.subscriptionPlan` (`middleware/auth.ts:83–85`). There is **no scoping by team/club on these routes** — every list query filters by `userId: req.userId` (`services/calendar.ts:84–86`), so users only see their own events.

#### 2.1.1 `POST /calendar/events`

Source: `routes-calendar.ts:39–85`. Service: `createCalendarEvent` in `services/calendar.ts:25–63`.

- **Auth**: `authenticate` + `requireFeature('canAccessCalendar')` (`routes-calendar.ts:39`).
- **Body** (JSON, ad-hoc parsing — **no Zod**):

| Field | Type | Required | Notes |
|---|---|---|---|
| `sessionId` | string | yes | Must reference an existing `Session`; otherwise `500` with `error: "Session not found"` (`services/calendar.ts:35–37`). No UUID format check. |
| `scheduledDate` | ISO date string | yes | Coerced via `new Date(scheduledDate)` (`routes-calendar.ts:65`). Invalid dates become `Invalid Date`; downstream Prisma write will throw. |
| `durationMin` | number | no | Coerced via `Number()`. Falls back to `session.durationMin || 60` (`services/calendar.ts:46`). |
| `notes` | string | no | Trimmed to string. |
| `location` | string | no | Trimmed to string. |
| `teamName` | string | no | **Legacy free-text** (does **not** create a `teamId` link — see `services/calendar.ts:49`). |

- **Validation rules**: only the "sessionId and scheduledDate are required" guard at `routes-calendar.ts:56–61`. No date-order check, no duration min/max, no overlap detection.
- **Response 200**:

```ts
{ ok: true, event: CalendarEventWithUser }   // routes-calendar.ts:74-77
```

`event` includes the row plus `user: { id, name, email }` from the explicit `include` (`services/calendar.ts:51–59`). Note: this endpoint does **not** pre-join the linked `Session` (only the coach-center route does).

- **Side effects**:
  - Writes one row to `CalendarEvent` with `userId = req.userId`, `sessionRefCode = session.refCode`.
  - **No cache invalidation, no push notifications, no audit log.** `originalCoachId`/`assignedByUserId` are **left null** in this path (`services/calendar.ts:40–50`) — those fields are only set by the DOC Hub assign path.
  - **No transaction**: the `session.findUnique` and `calendarEvent.create` are two round-trips (`services/calendar.ts:30,40`).

- **Errors**:
  - `400` if `sessionId` or `scheduledDate` missing.
  - `401` if not authenticated.
  - `403` (from `requireFeature`) if subscription lacks `canAccessCalendar`.
  - `500` with `error: "Session not found"` if the sessionId is bad; otherwise the underlying Prisma error message.

#### 2.1.2 `GET /calendar/events`

Source: `routes-calendar.ts:92–168`. Service: `getCalendarEvents` in `services/calendar.ts:68–156` (or `getCalendarEventsByDate` at `services/calendar.ts:246–269`).

- **Auth**: `authenticate` + `requireFeature('canAccessCalendar')`.
- **Query params**:

| Param | Type | Notes |
|---|---|---|
| `startDate` | ISO date | Optional. Parsed via `new Date()`; `400` if `Invalid Date` (`routes-calendar.ts:113–122`). |
| `endDate` | ISO date | Optional. Same handling (`routes-calendar.ts:123–132`). |
| `includeCompleted` | `"true"` | Default `true` (`services/calendar.ts:81`); setting to anything else hides completed events. |
| `includeCancelled` | `"true"` | Default `false` (`services/calendar.ts:82`); must explicitly include to see cancelled. |
| `groupByDate` | `"true"` | Requires both `startDate` and `endDate` (`routes-calendar.ts:140`); switches response shape to `eventsByDate`. |

- **Filtering**:
  - `where.userId = req.userId` always (`services/calendar.ts:85`).
  - `where.scheduledDate.gte = startDate`, `where.scheduledDate.lte = endDate` when supplied (`services/calendar.ts:89–97`).
  - `where.completed = false` if `!includeCompleted` (`services/calendar.ts:100–102`).
  - `where.cancelled = false` if `!includeCancelled` (`services/calendar.ts:103–105`).
- **Sorting**: `orderBy: { scheduledDate: "asc" }` (`services/calendar.ts:110`).
- **Pagination**: **none**. Returns every match. (No `take`, no cursor, no offset.)
- **Session join**: N+1 — for each event, the handler runs `prisma.session.findUnique` and merges `{ ..., session }` (`services/calendar.ts:122–149`). If the session lookup throws, the event is returned with `session: null` and the error is logged (`services/calendar.ts:140–147`).
- **Response 200 (default)**:

```ts
{
  ok: true,
  events: Array<{
    ...CalendarEventRow,
    user: { id, name },                      // from the include
    session: { id, title, ageGroup, durationMin, gameModelId, refCode } | null,
  }>
}
```

- **Response 200 (`groupByDate=true`)**:

```ts
{
  ok: true,
  eventsByDate: Record<"YYYY-MM-DD", typeof events>   // services/calendar.ts:147-150,258-266
}
```

Note `getCalendarEventsByDate` hardcodes `includeCancelled: false` (`services/calendar.ts:254`) regardless of the query param.

- **Side effects**: none.

#### 2.1.3 `GET /calendar/events/:eventId`

Source: `routes-calendar.ts:174–207`. Service: `getCalendarEvent` (`services/calendar.ts:161–181`).

- **Auth**: `authenticate` only — **no `requireFeature` on this route** (`routes-calendar.ts:174`).
- **Path params**: `eventId` (string).
- **Ownership**: filtered by `where: { id: eventId, userId: req.userId }` (`services/calendar.ts:165–169`). Different-user requests get `null` → `404`.
- **Response 200**:

```ts
{
  ok: true,
  event: { ...CalendarEventRow, user: { id, name }, session: SessionFull }   // routes-calendar.ts:193-199
}
```

The `session` here is the *full* `Session` row (line 189–191) — distinct from the partial projection used in the list endpoint.

- **Errors**: `404` if not found / not yours; `500` on internal errors.

#### 2.1.4 `PATCH /calendar/events/:eventId`

Source: `routes-calendar.ts:213–267`. Service: `updateCalendarEvent` (`services/calendar.ts:186–217`).

- **Auth**: `authenticate` + `requireFeature('canAccessCalendar')`.
- **Body** (any subset):

| Field | Type | Notes |
|---|---|---|
| `scheduledDate` | ISO date | Coerced via `new Date()`. |
| `durationMin` | number | Coerced via `Number()`. |
| `notes` | string \| null | Empty string → `undefined` (i.e. cleared). |
| `location` | string \| null | Same. |
| `teamName` | string \| null | Same. |
| `completed` | boolean | Coerced via `Boolean()`. |
| `cancelled` | boolean | Coerced via `Boolean()`. |

- **Ownership**: `prisma.calendarEvent.findFirst({ where: { id: eventId, userId } })` (`services/calendar.ts:192–197`) — throws `"Calendar event not found or access denied"` otherwise.
- **Response 200**: `{ ok: true, event: { ...updated, user: { id, name } } }`.
- **Side effects**: none beyond the row update. **Note: `originalCoachId`, `assignedByUserId`, `reassignedBy`, `reassignedAt` are NOT exposed via this PATCH** — those audit fields can only be mutated by the DOC Hub reassign endpoint.

#### 2.1.5 `DELETE /calendar/events/:eventId`

Source: `routes-calendar.ts:273–293`. Service: `deleteCalendarEvent` (`services/calendar.ts:222–241`).

- **Auth**: `authenticate` + `requireFeature('canAccessCalendar')`.
- **Behavior**: ownership check via `findFirst({ id, userId })` (`services/calendar.ts:227–232`), then `prisma.calendarEvent.delete({ where: { id: eventId } })` (line 238–240). Hard delete — not a soft cancel.
- **Response 200**: `{ ok: true }`.
- **Side effects**: none.

#### 2.1.6 `GET /calendar/weekly-summary`

Source: `routes-calendar.ts:300–355`. Services: `generateWeeklySummary` (`services/weekly-summary.ts:1–210`) + `generateWeeklySummaryPdf` (`services/pdf-export.ts`).

- **Auth**: `authenticate` + `requireFeature('canGenerateWeeklySummaries')` (`routes-calendar.ts:300`).
- **Query params**:
  - `weekStart` (ISO date, required).
  - `weekEnd` (ISO date, required).
  - `format` — optional `"pdf"` → returns `application/pdf` (`routes-calendar.ts:332–340`).
- **Validation**: `400` if either date missing or `Invalid Date`.
- **Response 200 (JSON)**:

```ts
{
  ok: true,
  summary: WeeklySummary,                     // services/weekly-summary.ts:29-36
  text: string                                // formatWeeklySummaryAsText(summary)
}
```

Where `WeeklySummary` is (`services/weekly-summary.ts:29–36`):

```ts
{
  weekStart: Date,
  weekEnd: Date,
  events: WeeklySummaryEvent[],               // services/weekly-summary.ts:11-19
  totalSessions: number,
  totalMinutes: number,
  ageGroups: string[],
}
```

- **Response 200 (`format=pdf`)**: binary PDF, `Content-Disposition: attachment; filename="weekly-summary-<weekStart>-<weekEnd>.pdf"`.
- **Side effects**: none.

### 2.2 Coach Center team calendar

`apps/api/src/routes-coach-center.ts:79–89`.

#### 2.2.1 `GET /coach-center/teams/:teamId/calendar?weekStart=YYYY-MM-DD`

- **Auth**: `authenticate` only (`routes-coach-center.ts:79`). No `requireFeature`. The handler delegates to `requireTeamAccess(userId, teamId)` (defined in `services/coach-center.ts`) so only coaches with team access can read.
- **Service**: `getTeamCalendar` at `services/coach-center.ts:1014–1075`.
- **Behavior**: returns the *calling user's* events for the given team during the Mon→Sun week starting at `weekStart`. Filters `where: { userId, cancelled: false, scheduledDate: { gte, lt: gte+7 } }` (`services/coach-center.ts:1021–1026`).
- **Response 200**: weekly grid of `{ date, dayLabel, events: [...] }` per day.
- **No "upcoming" or "next N events" subroute** exists at this level.

### 2.3 DOC Hub calendar endpoints (`/doc-hub/clubs/:clubId/...`)

Mounted at `apps/api/src/app.ts:79`. All gated by `requireClubRole(DOC_HUB_ROLES)` (`routes-doc-hub.ts:410, 452, 484`), where `DOC_HUB_ROLES = [ClubRole.DOC, ClubRole.SECTION_DIRECTOR]` (`services/club-memberships.ts:5`). The middleware (`apps/api/src/middleware/club-auth.ts:31–116`) requires an authenticated `ClubMembership` of one of those roles; SUPER_ADMIN bypasses and gets `clubAccessViaSuperAdmin: true`.

#### 2.3.1 `GET /doc-hub/clubs/:clubId/calendar/week?weekStart=&coachUserId=&sectionId=`

`routes-doc-hub.ts:359–381`. Service: `getClubCalendarWeek` (`services/club-coach-overview.ts:294–423`).

- **Behavior**: lists every non-cancelled event whose `userId` is in the club's coach roster (filtered by `sectionId` if the requester is a Section Director without club-wide scope). Range is `[weekStart, weekStart+7d)`.
- **Response 200**: Mon–Sun grid, 7 days × N coaches, with cells shaped like `CalendarCellEvent` (see `services/club-coach-overview.ts:283–292`) — minimal fields plus `isCoverage: boolean` derived from `originalCoachId !== userId`.
- **No pagination**.

#### 2.3.2 `GET /doc-hub/clubs/:clubId/vault/sessions?ageGroup=&limit=`

`routes-doc-hub.ts:387–402`. Service: `listClubVaultSessions` (`services/club-calendar-assign.ts:195–222`).

- **Paging**: `limit` (number, default `100`).
- **Filters**: `ageGroup` (string, optional); sessions must match the club's `gameModelId`.
- **Use**: feeds the "Add to Coach" picker.

#### 2.3.3 `POST /doc-hub/clubs/:clubId/calendar/assign`

`routes-doc-hub.ts:408–444`. Service: `assignSessionToCoach` (`services/club-calendar-assign.ts:224–269`).

- **Body** (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `coachUserId` | string (UUID) | yes | Target coach. Must be in the requester's manageable roster (`assertRequesterManagesCoach`, line 237; throws `COACH_OUT_OF_SCOPE`). |
| `sessionId` | string | yes | Must be in the vault (`savedToVault = true`, line 127–133; `SESSION_NOT_IN_VAULT`) and visible to the club (`sessionVisibleToClub`, line 134–147; `SESSION_CLUB_MISMATCH`). |
| `scheduledDate` | ISO date | yes | `400` on `Invalid Date`. |
| `durationMin` | number | no | Coerced via `Number()`. |
| `notes` | string | no | — |
| `location` | string | no | — |
| `teamName` | string | no | — |
| `allowConflict` | boolean | no | If `false` (default), rejects with `409 DAY_CONFLICT` if the coach already has a non-cancelled event on the same UTC day (`findDayConflicts`, line 92–108; `allowConflict` check at line 241–251). |

- **Response 201**: `{ ok: true, event }` where `event` is the serialized form from `serializeEvent` (`services/club-calendar-assign.ts:151–193`):

```ts
{
  id, userId, sessionId, sessionRefCode,
  scheduledDate: ISOString,
  durationMin, notes, location, teamName,
  originalCoachId, assignedByUserId, reassignedBy, reassignedAt,
  completed, cancelled,
  session?: { id, refCode, title, durationMin }   // only if loadAssignableSession succeeded
}
```

- **Side effects**: writes `CalendarEvent` row with `originalCoachId = coachUserId` and `assignedByUserId = requesterUserId` (`services/club-calendar-assign.ts:253–266`). No notifications, no audit log beyond the row itself.

#### 2.3.4 `POST /doc-hub/clubs/:clubId/calendar/auto-populate`

`routes-doc-hub.ts:450–477`. Service: `autoPopulateCoachWeek` (`services/club-calendar-assign.ts:280–380`).

- **Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `coachUserId` | string | yes | — |
| `weekStart` | YYYY-MM-DD | no | Defaults via `resolveWeekBounds`. |
| `sessionIds` | string[] | no | If supplied, exactly these vault sessions are used; otherwise the latest 20 vault sessions for the club's game model. |
| `defaultTime` | `"HH:MM"` | no | Defaults to `"17:00"` (`parseDefaultTime`, line 271–278). Hours clamped to `0..23`, minutes to `0..59`. |
| `ageGroup` | string | no | Used only when fetching the default session pool. |
| `skipDaysWithEvents` | boolean | no | Default `true` (line 295). If `true`, days with existing non-cancelled events are skipped with reason `DAY_ALREADY_HAS_EVENT`. |

- **Behavior**: iterates Mon–Fri (i = 0..4, line 337), schedules one event per day at the default time. Sessions are consumed from the pool in order.
- **Response 200**: `{ ok: true, weekStart, weekEnd, created: SerializedEvent[], skipped: Array<{ date, reason }> }`.
- **Side effects**: bulk insert of up to 5 events with `notes: "Auto-populated by DOC Hub"` and the same `originalCoachId`/`assignedByUserId` semantics as assign (line 359–370).

#### 2.3.5 `POST /doc-hub/clubs/:clubId/calendar/reassign`

`routes-doc-hub.ts:483–519`. Service: `reassignCalendarEvent` (`services/club-calendar-assign.ts:382–444`).

- **Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `eventId` | string | yes | Must exist and not be cancelled (`event.cancelled` check, line 395–397). |
| `toCoachUserId` | string (UUID) | yes | Substitute coach. Requester must manage **both** current owner and substitute (`assertRequesterManagesCoach` called twice, line 400–401). |
| `scheduledDate` | ISO date | no | If omitted, keeps the existing date. |
| `notes` | string \| null | no | Overrides existing notes if provided. |
| `allowConflict` | boolean | no | Same UTC-day conflict check as assign (line 412–424); the event being moved is excluded from the conflict check. |

- **Behavior**:
  - `400 NO_CHANGE` if `toCoachUserId === current userId` and no date/note change.
  - Updates the row: `userId = toCoachUserId`, `scheduledDate = nextDate`, `originalCoachId = existing.originalCoachId ?? existing.userId`, `reassignedBy = requesterUserId`, `reassignedAt = now()` (line 426–436).
- **Response 200**: `{ ok: true, event }` (serialized as in 2.3.3).

### 2.4 No `GET /calendar/upcoming`

There is no dedicated "upcoming" endpoint. Clients compose `startDate=now()` against the list endpoint or use `getTeamCalendar`.

---

## 3. Enums and types

There are **no calendar-specific enums**. Status is modeled as two booleans (`completed`, `cancelled`). Event types are not distinguished — every `CalendarEvent` is implicitly "scheduled training session" tied to a `Session`.

Adjacent enums that gate access:

`UserRole` (`schema.prisma:52–58`):
```prisma
FREE | COACH | CLUB | ADMIN | TRIAL
```

`SubscriptionPlan` (`schema.prisma:88–95`):
```prisma
FREE | COACH_BASIC | COACH_PRO | CLUB_STANDARD | CLUB_PREMIUM | TRIAL
```

`SubscriptionStatus` (`schema.prisma:97–102`):
```prisma
ACTIVE | CANCELLED | EXPIRED | TRIAL
```

`ClubRole` (`schema.prisma:65–69`):
```prisma
DOC | SECTION_DIRECTOR | COACH
```

`TeamCoachRole` (`schema.prisma:71–74`):
```prisma
HEAD | ASSISTANT
```

TypeScript input shapes (`apps/api/src/services/calendar.ts:3–20`):
```ts
export interface CreateCalendarEventInput {
  sessionId: string;
  scheduledDate: Date;
  durationMin?: number;
  notes?: string;
  location?: string;
  teamName?: string;
}
export interface UpdateCalendarEventInput {
  scheduledDate?: Date;
  durationMin?: number;
  notes?: string;
  location?: string;
  teamName?: string;
  completed?: boolean;
  cancelled?: boolean;
}
```

The DOC Hub path returns a richer event shape from `serializeEvent` (`apps/api/src/services/club-calendar-assign.ts:151–193`) that includes the reassignment trail.

---

## 4. Recurrence support

**None.** Searched the schema, migrations, and routes for `rrule`, `recurrence`, `frequency`, `byweekday`, and `recurring` — no hits. Each `CalendarEvent` is a single concrete `(scheduledDate, durationMin)` tuple. Repeating schedules are *emulated* by clients (or by `autoPopulateCoachWeek`, which inserts up to 5 separate rows, one per Mon–Fri, `services/club-calendar-assign.ts:337`). There is no parent "series" row that aggregates them, and no expansion rule.

---

## 5. Notable constraints

### 5.1 Auth + feature gating
- `/calendar/events*` and `/calendar/weekly-summary` require `authenticate` (`routes-calendar.ts:33`). Every event endpoint except `GET /calendar/events/:eventId` also requires `requireFeature('canAccessCalendar')` (or `canGenerateWeeklySummaries` for the summary route). `FREE` plan is blocked from all of them (`subscription-limits.ts:10`).
- DOC Hub routes use a separate `requireClubRole(DOC_HUB_ROLES)` middleware (`middleware/club-auth.ts:31`) that checks `ClubMembership` and only allows `DOC` or `SECTION_DIRECTOR`. SUPER_ADMIN bypasses.
- There is **no `requireAdmin`** on calendar routes — the comment at `routes-calendar.ts:5–6` explicitly notes this is intentional ("any authenticated user can schedule sessions"). Calendar routes are mounted before admin routes in `app.ts:76–80` so the platform-wide admin gate doesn't intercept them.

### 5.2 Data integrity
- `CalendarEvent.sessionId` is a plain `String`, **not** a `@relation` (`schema.prisma:647`). Deleting a `Session` does not cascade. Admin cleanup paths exist (`routes-admin.ts:1854, 2661`) but the calendar service itself never validates the session is still present at read time — the list endpoint returns `session: null` when missing (`services/calendar.ts:140–147`).
- `teamId` is a real FK with `onDelete: SetNull` (`schema.prisma:658–659`).
- The `notes` field is read as a plain string into the JSON response — there is no escaping/PII handling.

### 5.3 Conflict detection
- **Self-calendar endpoints**: no conflict check. A coach can `POST /calendar/events` two events at the same wall-clock minute and both will persist.
- **DOC Hub `assign` / `reassign` / `auto-populate`**: do a UTC-day conflict check via `findDayConflicts` (`services/club-calendar-assign.ts:92–108`). The window is `[00:00 UTC, 24:00 UTC)` of the event's day. Bypassed only when the caller explicitly sends `allowConflict: true`. The check excludes the event being moved on reassign (`c.id !== event.id`, line 414).
- "Busy-check" endpoints (free-busy queries across many users) do **not** exist.

### 5.4 Pagination + performance
- No pagination anywhere. `GET /calendar/events` will return every matching row.
- `getCalendarEvents` is N+1: one query per session lookup (`services/calendar.ts:122–149`). `getClubCalendarWeek` batches with `findMany({ id: { in: sessionIds } })` (`services/club-coach-overview.ts:341`); `getTeamCalendar` does the same (`services/coach-center.ts:1030`).

### 5.5 Validation gaps
- **No Zod schemas** on calendar routes (`routes-calendar.ts`). Validation is ad-hoc `String()` / `Number()` / `Boolean()` coercion plus a single `if (!sessionId || !scheduledDate)` check at `routes-calendar.ts:56–61`. Invalid date strings reach Prisma and surface as `500`s rather than `400`s.
- `durationMin` has no min/max bounds. Negative or zero durations are accepted.
- `scheduledDate` has no "must be in the future" or "must be within N days" guard.
- `teamName` (legacy free-text) is not cross-checked against the `Team` table — setting `teamName` does **not** populate `teamId`.

### 5.6 Cache, push, audit
- **No HTTP cache headers** are set on any response.
- **No push notifications / emails** on event create/update/delete. `generateWeeklySummaryPdf` produces a PDF on demand but does not send it.
- The only audit trail is the row itself (`originalCoachId`, `assignedByUserId`, `reassignedBy`, `reassignedAt`, `createdAt`, `updatedAt`). There is no separate `AuditLog` model for calendar actions.

### 5.7 Clock semantics
- All event timestamps are stored as `DateTime` (no TZ column). The mobile/UI side treats them as wall-clock; DOC Hub conflict checks are **strictly UTC-day** (`utcDayRange`, `services/club-calendar-assign.ts:83–90`). This is the most likely source of off-by-one-day bugs around midnight UTC.
- `weekStart`/`weekEnd` for weekly summary are interpreted by `generateWeeklySummary` (`services/weekly-summary.ts:1–210`); the Club calendar week is always Mon→Sun UTC (`services/club-coach-overview.ts:294–370`).

### 5.8 Mobile parity
- The mobile app's `apps/mobile/services/calendar.service.ts` (per the git-status snapshot) talks to these exact endpoints with `startDate`/`endDate`/`includeCompleted`/`includeCancelled`/`groupByDate`. There are no hidden server-only endpoints used by mobile.

---

## Appendix — file index

| Path | Role |
|---|---|
| `apps/api/prisma/schema.prisma:639–686` | `CalendarEvent` model |
| `apps/api/prisma/migrations/20260124010128_add_calendar_events/migration.sql` | Initial CREATE TABLE + indexes |
| `apps/api/src/routes-calendar.ts` | Self-calendar router (`/calendar/*`) |
| `apps/api/src/services/calendar.ts` | CRUD service + grouping helper |
| `apps/api/src/routes-doc-hub.ts:359–519` | DOC Hub calendar router |
| `apps/api/src/services/club-calendar-assign.ts` | Assign / auto-populate / reassign + conflict checks |
| `apps/api/src/services/club-coach-overview.ts:294–423` | `getClubCalendarWeek` (multi-coach grid) |
| `apps/api/src/services/coach-center.ts:1014–1075` | `getTeamCalendar` (coach-center team view) |
| `apps/api/src/middleware/auth.ts:187–214` | `requireFeature` middleware |
| `apps/api/src/middleware/club-auth.ts:31–116` | `requireClubRole` middleware |
| `apps/api/src/services/club-memberships.ts:5` | `DOC_HUB_ROLES` constant |
| `apps/api/src/services/weekly-summary.ts:29–36` | `WeeklySummary` shape |
| `apps/api/src/config/subscription-limits.ts` | Per-plan `canAccessCalendar` / `canGenerateWeeklySummaries` |
| `apps/api/src/app.ts:75–80` | Router mount order (calendar before admin) |