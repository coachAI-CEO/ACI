# Phase 5 — Calendar, Player Plans & PDF Sharing

> **Duration:** Week 10–11
> **Goal:** Coaches can schedule training sessions, view their weekly calendar, generate individual player plans from team sessions, and share PDFs natively via the system share sheet (WhatsApp, iMessage, email, AirDrop).

---

## Deliverables

- [ ] Calendar tab with month/week view
- [ ] Create calendar event (link to session/series)
- [ ] Update and delete events
- [ ] Weekly AI summary (coaching insights for the week)
- [ ] Player plans list and detail view
- [ ] Create player plan from session or series
- [ ] Player plan PDF export + share
- [ ] Share player plan ref code via native share sheet
- [ ] Schedule session modal (reused from Phase 2)
- [ ] Schedule series modal (all sessions in one flow)
- [ ] Feature gates for calendar and player plans

---

## File Structure for This Phase

```
app/
└── (tabs)/
    └── calendar.tsx               Calendar tab

app/
└── calendar/
    └── event/
        └── [eventId].tsx          Event detail screen

app/
└── player-plans/
    ├── index.tsx                   Player plans list
    └── [planId].tsx               Player plan detail

components/
├── calendar/
│   ├── CalendarMonthView.tsx      Month grid with event dots
│   ├── CalendarWeekView.tsx       Week horizontal scroll view
│   ├── DayEventList.tsx           Events for selected day
│   ├── EventCard.tsx              Event list item
│   ├── CreateEventModal.tsx       Bottom sheet: date/time/session picker
│   ├── EditEventModal.tsx         Edit an existing event
│   ├── WeeklySummaryCard.tsx      AI weekly summary card
│   ├── ScheduleSessionModal.tsx   Link session to date (from Phase 2 action bar)
│   └── ScheduleSeriesModal.tsx    Schedule entire series across dates
├── player-plans/
│   ├── PlayerPlanCard.tsx         Card for plan list
│   ├── PlayerPlanDetail.tsx       Full plan view (exercises list)
│   ├── CreatePlanModal.tsx        Choose session/series → generate
│   └── SharePlanSheet.tsx         Share options: PDF, ref code, WhatsApp
└── pdf/
    └── PdfShareService.ts         export-print + expo-sharing wrapper

services/
├── calendar.service.ts            events CRUD + weekly summary
└── player-plans.service.ts        create, get, list, delete, export

hooks/
├── useCalendar.ts                 events by date range
├── useWeeklySummary.ts            fetch + cache weekly AI summary
└── usePlayerPlans.ts              list + create + export
```

---

## Screen Specifications

### Calendar Tab (`app/(tabs)/calendar.tsx`)

#### Header
```
February 2026             [+ Add]   [Week/Month]
```

Toggle between Month and Week view.

#### Month View
```
  M    T    W    T    F    S    S
  2    3    4    5    6    7    8
  9   ●10  11   ●12  13   14   15   ← dots = events
  16   17   18   19   20   21   22
  23   24   25   26   27   28
```
Tapping a date selects it and shows that day's events below.

#### Week View (horizontal scroll)
```
Mon 9  Tue 10  Wed 11  Thu 12  Fri 13
       ●        ●
  Practice      Tactical session
  4:00pm        5:30pm
```

#### Selected Day Events
```
Tuesday, February 10
────────────────────
4:00pm – 5:00pm
[SESSION CARD]
S-M9V4 · U14 Boys · Pressing
60 min
[Edit] [Delete]

────────────────────
+ Add event for this day
```

#### Weekly Summary Card
Below the calendar, if the user has `canGenerateWeeklySummaries`:
```
┌──────────────────────────────────┐
│  🧠 Weekly Coaching Summary      │
│  Week of Feb 10–16               │
│──────────────────────────────────│
│  3 sessions scheduled            │
│  Focus: Pressing transition...   │
│  [Read full summary →]           │
└──────────────────────────────────┘
```

Tapping opens a full-screen modal with the AI-generated text.

Feature gate: hidden for users without `canGenerateWeeklySummaries`.

---

### Create Event Modal

Triggered by `[+ Add]` button or `+ Add event for this day`:

```
┌──────────────────────────────────┐
│  Schedule Session           [✕] │
│──────────────────────────────────│
│  Date                            │
│  [Feb 10, 2026              ▾]  │
│                                  │
│  Time                            │
│  [4:00 PM                   ▾]  │
│                                  │
│  Session                         │
│  [Search vault or generate  ▾]  │
│                                  │
│  Notes (optional)                │
│  [_________________________]    │
│                                  │
│  [📅 Schedule]                   │
└──────────────────────────────────┘
```

**Session picker bottom sheet:**
```
Search vault: [🔍 ...]
─────────────────────
Recent sessions:
S-M9V4  U14 Pressing  60m
S-K2P1  U12 Possession 60m
─────────────────────
[Or generate a new session →]
```

**API:** `POST /calendar/events` with `{ date, time, sessionId, notes }`

---

### Event Detail Screen (`app/calendar/event/[eventId].tsx`)

```
Tuesday, Feb 10, 4:00 PM – 5:00 PM
────────────────────────────────────
S-M9V4  U14 Boys · Pressing · 60 min
────────────────────────────────────
Notes: Training ground, Pitch B

[Open Session Details]  [Edit]  [Delete]
```

**Edit:** Opens `EditEventModal` with fields pre-filled.
**Delete:** Confirm dialog → `DELETE /calendar/events/:eventId`.
**Open Session:** Navigates to session detail from vault.

---

### Schedule Session Modal (from session action bar in Phase 2)

```
Schedule this Session
─────────────────────
S-M9V4 · U14 Pressing

Date: [Feb 10, 2026   ▾]
Time: [4:00 PM         ▾]

[📅 Add to Calendar]
```

Same as create event modal but with session pre-filled.

---

### Schedule Series Modal

When scheduling an entire series (from series detail):

```
Schedule Series: SR-K9P2
──────────────────────────
U12 Possession · 4 Sessions

Session 1  [Feb 10 ▾]  [4:00 PM ▾]
Session 2  [Feb 17 ▾]  [4:00 PM ▾]
Session 3  [Feb 24 ▾]  [4:00 PM ▾]
Session 4  [Mar 3  ▾]  [4:00 PM ▾]

[Repeat time for all sessions]

[📅 Schedule All 4 Sessions]
```

Auto-suggests dates 1 week apart from first selection.
Creates 4 separate `POST /calendar/events` calls sequentially.

---

### Player Plans Tab / Screen

Accessible from:
- Settings or profile menu → "Player Plans"
- Session detail → action bar → "Create Player Plan"

**Player Plans List (`app/player-plans/index.tsx`):**

```
Player Plans (5)               [+ Create]
──────────────────────────────────────────
┌────────────────────────────────────────┐
│  P-Q2T6                          [🗑️] │
│  From: S-M9V4 · U14 Pressing          │
│  6 individual exercises                │
│  Created Jan 15, 2026                  │
│  [Share PDF]  [Share Code]             │
└────────────────────────────────────────┘
```

---

### Create Player Plan Modal

Triggered from session detail or `[+ Create]` button:

```
┌──────────────────────────────────┐
│  Create Player Plan         [✕] │
│──────────────────────────────────│
│  Source                          │
│  ● From this session (S-M9V4)   │
│  ○ From a series (SR-XXXX)      │
│                                  │
│  Player Name (optional)          │
│  [Player name for PDF header]   │
│                                  │
│  [⚡ Generate Plan]              │
└──────────────────────────────────┘
```

**API:**
- From session: `POST /player-plans/from-session/:sessionId`
- From series: `POST /player-plans/from-series/:seriesId`

**Loading:** Shows spinner with text "Adapting drills for solo training..."

**On success:** Navigate to player plan detail.

---

### Player Plan Detail (`app/player-plans/[planId].tsx`)

```
P-Q2T6
────────────────────────────────────
From: S-M9V4 · U14 Pressing · 60 min
6 Individual Exercises

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Exercise 1: Solo Pressing Footwork
10 min · No equipment needed
────────────────────────────────────
[Instructions text...]

Coaching Cues:
• Accelerate on the trigger
• Stay on your toes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Exercise 2: Wall Pass Reaction
15 min · Wall / rebounder
────────────────────────────────────
[Instructions text...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[📄 Export PDF]    [🔗 Share Code]
```

---

### Share Player Plan

Tapping `[Share PDF]` or `[Export PDF]`:
1. Call `POST /player-plans/:planId/export-pdf`
2. Receive PDF blob
3. Save to temp file
4. Open `expo-sharing` → native share sheet

**Native share sheet options:**
- WhatsApp → sends PDF file (most common for coaches)
- iMessage → sends PDF
- Email → attaches PDF
- AirDrop → transfers directly (iOS only)
- Save to Files → saves to device

Tapping `[🔗 Share Code]`:
1. Opens native share sheet with text: "Training plan: P-Q2T6 — TacticalEdge App"
2. Coach pastes code, player looks up via app or web

---

## API Calls in This Phase

| Action | Method | Endpoint | Feature Required |
|---|---|---|---|
| List events | GET | `/calendar/events` | canAccessCalendar |
| Create event | POST | `/calendar/events` | canAccessCalendar |
| Get event | GET | `/calendar/events/:eventId` | canAccessCalendar |
| Update event | PATCH | `/calendar/events/:eventId` | canAccessCalendar |
| Delete event | DELETE | `/calendar/events/:eventId` | canAccessCalendar |
| Weekly summary | GET | `/calendar/weekly-summary` | canGenerateWeeklySummaries |
| Create plan (session) | POST | `/player-plans/from-session/:id` | canCreatePlayerPlans |
| Create plan (series) | POST | `/player-plans/from-series/:id` | canCreatePlayerPlans |
| List plans | GET | `/player-plans` | canCreatePlayerPlans |
| Get plan | GET | `/player-plans/:planId` | canCreatePlayerPlans |
| Export plan PDF | POST | `/player-plans/:planId/export-pdf` | canCreatePlayerPlans |
| Delete plan | DELETE | `/player-plans/:planId` | canCreatePlayerPlans |

---

## Testing Scenarios — Phase 5

### CAL-001: Calendar Loads Events for Current Month

```
Steps:
1. Navigate to Calendar tab
2. Assert: GET /calendar/events called with current month range
3. Assert: event dots appear on correct dates
4. Assert: today's date highlighted
5. Tap a date with an event
6. Assert: event card appears below calendar

API mock: GET /calendar/events → [event on Feb 10 and Feb 12]
```

---

### CAL-002: Calendar Feature Gate (FREE User)

```
Steps:
1. Login as FREE user
2. Navigate to Calendar tab
3. Assert: entire tab shows upgrade prompt
4. Assert: no calendar UI shown
5. Assert: [Upgrade to COACH_BASIC] button shown

State: user features canAccessCalendar = false
```

---

### CAL-003: Create Calendar Event

```
Steps:
1. Tap [+ Add] button on calendar
2. Assert: create event modal opens
3. Select date: Feb 15
4. Select time: 4:00 PM
5. Tap session picker → search "S-M9V4"
6. Select S-M9V4 from results
7. Add notes: "Pitch A"
8. Tap [Schedule]
9. Assert: POST /calendar/events called with correct body
10. Assert: modal closes
11. Assert: dot appears on Feb 15 in calendar
12. Assert: tap Feb 15 → event card shown

API mock: POST /calendar/events → { id: "evt1", date: "2026-02-15" }
```

---

### CAL-004: Delete Event

```
Steps:
1. Tap event card on selected day
2. Assert: event detail screen opens
3. Tap [Delete]
4. Assert: confirm dialog shown
5. Tap [Cancel] → Assert: event detail still shown
6. Tap [Delete] again → confirm → tap [Delete]
7. Assert: DELETE /calendar/events/:id called
8. Assert: navigated back to calendar
9. Assert: event dot removed from date

API mock: DELETE /calendar/events/:id → 200
```

---

### CAL-005: Schedule Series Across Multiple Dates

```
Steps:
1. Navigate to Vault → Series → open SR-K9P2
2. Tap [Schedule Series]
3. Assert: schedule series modal opens with 4 date pickers
4. Set Session 1: Feb 10, 4:00 PM
5. Assert: Session 2 auto-populates as Feb 17
6. Assert: Session 3 = Feb 24, Session 4 = Mar 3
7. Adjust Session 3 to Feb 25
8. Tap [Schedule All 4 Sessions]
9. Assert: 4x POST /calendar/events calls made sequentially
10. Assert: success toast "4 sessions scheduled"
11. Assert: dots appear on all 4 dates in calendar

API mock: POST /calendar/events → 200 (4 times)
```

---

### CAL-006: Weekly Summary

```
Steps:
1. Login as COACH_PRO user
2. Navigate to Calendar tab
3. Assert: weekly summary card shown below calendar
4. Assert: card shows session count and summary preview
5. Tap [Read full summary →]
6. Assert: full summary modal opens
7. Assert: full AI-generated text shown

API mock: GET /calendar/weekly-summary → { summary: "This week you have 3 sessions..." }
```

---

### PLAN-001: Create Player Plan from Session

```
Steps:
1. Navigate to vault session S-M9V4
2. Tap [Create Player Plan] in action bar (or from session detail)
3. Assert: create plan modal opens
4. Select [From this session]
5. Enter player name: "Alex"
6. Tap [Generate Plan]
7. Assert: loading spinner shown
8. Assert: POST /player-plans/from-session/:sessionId called
9. Assert: navigated to player plan detail P-XXXX
10. Assert: 6 exercises listed
11. Assert: "Alex" shown in plan header

API mock: POST /player-plans/from-session → { id, refCode: "P-Q2T6", exercises: [...6] }
```

---

### PLAN-002: Player Plans List

```
Steps:
1. Navigate to Player Plans screen
2. Assert: GET /player-plans called
3. Assert: plan cards show: ref code, source session, exercise count, date
4. Assert: [Share PDF] and [Share Code] buttons on each card

API mock: GET /player-plans → [5 plans]
```

---

### PLAN-003: Export and Share PDF

```
Steps:
1. View player plan P-Q2T6
2. Tap [Export PDF]
3. Assert: POST /player-plans/P-Q2T6/export-pdf called
4. Assert: loading shown on button during request
5. Assert: native share sheet opens with PDF file
6. Assert: PDF filename: "P-Q2T6-player-plan.pdf"
7. Tap [Save to Files] on share sheet
8. Assert: PDF saved to device files

API mock: POST /player-plans/:id/export-pdf → binary PDF
```

---

### PLAN-004: Share Plan Ref Code

```
Steps:
1. View player plan P-Q2T6
2. Tap [Share Code]
3. Assert: native share sheet opens with text message
4. Assert: text includes ref code "P-Q2T6" and brief instructions
5. User can select WhatsApp, iMessage, etc.

Expected share text: "Here's your training plan: P-Q2T6 — Open in TacticalEdge"
```

---

### PLAN-005: Delete Player Plan

```
Steps:
1. Tap [🗑️] on a plan card in list
2. Assert: confirm dialog
3. Confirm delete
4. Assert: DELETE /player-plans/:id called
5. Assert: card animates out of list
6. Assert: count updated

API mock: DELETE /player-plans/:id → 200
```

---

### PLAN-006: Player Plans Feature Gate

```
Steps:
1. Login as FREE user
2. Navigate to session detail
3. Assert: [Create Player Plan] button is disabled / shows lock
4. Tap → Assert: upgrade prompt shown

State: user features canCreatePlayerPlans = false
```

---

### PLAN-007: Create Plan from Series

```
Steps:
1. Navigate to series detail SR-K9P2
2. Tap [Create Player Plan]
3. Select [From series SR-K9P2]
4. Tap [Generate Plan]
5. Assert: POST /player-plans/from-series/SR-K9P2 called
6. Assert: plan covers all sessions in series

API mock: POST /player-plans/from-series → { id, refCode: "P-XXXX", sessions: 4 }
```

---

## Acceptance Criteria for Phase 5

- [ ] Calendar month view shows event dots on correct dates
- [ ] Calendar week view shows events in horizontal scroll
- [ ] Tapping a date shows that day's events below
- [ ] Feature gate blocks FREE users from calendar with upgrade prompt
- [ ] Create event modal works with session picker from vault
- [ ] Editing an event pre-fills all fields correctly
- [ ] Deleting an event confirms before deleting and removes dot from calendar
- [ ] Schedule series modal auto-suggests weekly dates
- [ ] Series scheduling creates all events sequentially without race conditions
- [ ] Weekly summary card shows and full modal expands
- [ ] Weekly summary hidden for users without the feature
- [ ] Player plans list shows all plans with correct metadata
- [ ] Create plan from session works with optional player name
- [ ] Create plan from series works
- [ ] Player plan detail shows all exercises with equipment notes
- [ ] PDF export opens native share sheet with PDF attachment
- [ ] Share code opens native share sheet with ref code text
- [ ] Deleting plan confirms and animates card out
- [ ] Feature gates work for player plans on FREE plan
