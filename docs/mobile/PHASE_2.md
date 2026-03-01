# Phase 2 — Session, Drill & Series Generation

> **Duration:** Week 3–5
> **Goal:** Coaches can generate drills, full sessions, and progressive series. Results display with SVG diagrams, accordion drill lists, tabbed detail view, and save-to-vault actions.

---

## Deliverables

- [ ] Generate tab with sub-tabs: Drill / Session / Series
- [ ] Full generation form with all filter inputs
- [ ] Generation loading screen with progress animation
- [ ] Session result screen (accordion drills)
- [ ] Drill detail screen (tabbed: Setup / Coaching / Progressions)
- [ ] SVG diagram rendering via `react-native-svg`
- [ ] Diagram fullscreen modal with pinch-zoom
- [ ] Save to Vault action
- [ ] Export PDF via share sheet
- [ ] AI Chat (coaching assistant) floating button
- [ ] Generation cancellation
- [ ] Usage limit enforcement

---

## File Structure for This Phase

```
app/
└── (tabs)/
    ├── generate.tsx              Tab entry — sub-tab switcher
    └── generate/
        ├── drill.tsx             Drill generation form
        ├── session.tsx           Session generation form
        └── series.tsx            Series generation form

app/
└── session/
    ├── [sessionId].tsx           Session result / detail view
    └── drill/
        └── [drillId].tsx         Drill detail (tabs)

app/
└── series/
    └── [seriesId].tsx            Series overview screen

components/
├── generate/
│   ├── AgeGroupPicker.tsx        Horizontal scroll selector
│   ├── LevelSelector.tsx         Radio button group
│   ├── GameModelSelector.tsx     Segmented control
│   ├── PhaseSelector.tsx         Segmented control
│   ├── ZoneSelector.tsx          Segmented control
│   ├── DurationPicker.tsx        60 / 90 min toggle
│   ├── TopicPicker.tsx           Multi-select topic sheet
│   ├── FormationPicker.tsx       Formation grid picker
│   ├── PlayerCountInput.tsx      Numeric stepper
│   └── GenerateButton.tsx        Button with loading state
├── session/
│   ├── SessionHeader.tsx         Meta info (age, level, model)
│   ├── DrillAccordion.tsx        Collapsible drill list
│   ├── DrillAccordionItem.tsx    Single drill row
│   ├── DrillMiniNav.tsx          Sticky bottom drill navigator
│   ├── SessionActionBar.tsx      Save / Export / Schedule / Chat
│   └── SkillFocusTags.tsx        Horizontal tag scroll
├── drill/
│   ├── DrillTabView.tsx          Tab container
│   ├── SetupTab.tsx              Setup content + diagram thumbnail
│   ├── CoachingTab.tsx           Coaching points list
│   ├── ProgressionsTab.tsx       Progressions list
│   ├── DiagramThumbnail.tsx      Small diagram → opens modal
│   └── DiagramFullscreen.tsx     Pinch-zoom SVG modal
├── diagram/
│   └── UniversalDrillDiagram.tsx Ported from web (react-native-svg)
└── chat/
    ├── ChatFAB.tsx               Floating action button
    └── ChatModal.tsx             Bottom sheet chat interface

services/
├── session.service.ts            generate, getById, cancel
├── drill.service.ts              generate, getById
├── series.service.ts             generate, getById
├── vault.service.ts              save, remove, getSaveStatus
└── chat.service.ts               send message

stores/
└── generate.store.ts             form state + generation state

hooks/
├── useGenerate.ts                orchestrates generation + polling
├── useSaveToVault.ts             save/unsave with optimistic update
└── useDiagram.ts                 diagram data adapter
```

---

## Screen Specifications

### Generate Tab (`app/(tabs)/generate.tsx`)

Three sub-tabs implemented as a custom horizontal segmented control (not React Navigation tabs — avoids nested tab conflicts):

```
[Drill]  [Session]  [Series]
```

Persists the selected sub-tab in `generate.store.ts` so navigating away and back keeps selection.

---

### Session Generation Form (`app/(tabs)/generate/session.tsx`)

**All fields mirror the web `SessionForm` component.**

#### Field: Age Group
Horizontal scrollable chip selector:
```
U8  U9  U10  U11  U12  U13  U14  U15  U16  U17  U18
U12-Girls  U14-Girls  U16-Girls
```
Default: last used age group from user preferences.

#### Field: Player Level
Three-option radio group: Beginner / Intermediate / Advanced

#### Field: Coach Level
Three-option radio group: Grassroots / USSF-C / USSF-B+

#### Field: Game Model
Four-option horizontal selector: Possession / Pressing / Transition / CoachAI

#### Field: Phase
Three-option selector: Attacking / Defending / Transition

#### Field: Zone
Three-option selector: Def 3rd / Mid 3rd / Att 3rd

#### Field: Duration
Toggle: [60 min] [90 min]

#### Field: Players (attacker count, defender count)
Two numeric steppers with +/- buttons. Range: 3–11 each.

#### Field: Topic (optional)
Tap to open bottom sheet with topic hierarchy.
Shows: "3 selected" badge when topics chosen.
Organized by phase → zone → specific topics (mirrors `session-topics.ts`).

#### Field: Formation (optional)
Tap to open formation grid picker.

#### Generate Button
```
[⚡ Generate Session]
```
Disabled if: usage at limit, or required fields missing.
If at limit: button shows "Upgrade to generate more →" in red.

**Default values** loaded from Settings preferences (AsyncStorage).

---

### Generation Loading Screen

When generation starts, navigate to a full-screen loading view:

```
┌─────────────────────────────┐
│                        [✕] │  ← cancel button
│                             │
│      ⚽ [animated pitch]    │
│                             │
│  Generating your session... │
│                             │
│  ▓▓▓▓▓▓▓▓░░░░░░  60%       │
│                             │
│  "Building warmup drills"   │  ← progress messages
│                             │
│  This usually takes         │
│  30–90 seconds              │
│                             │
└─────────────────────────────┘
```

**Progress messages** cycle every ~5 seconds:
1. "Analyzing tactical context..."
2. "Building warmup drills..."
3. "Creating technical phase..."
4. "Adding tactical exercises..."
5. "Running quality checks..."
6. "Finalizing session..."

**Cancel:** Tapping ✕ → confirm dialog "Cancel generation?" → calls `POST /ai/cancel-generation`.

**Timeout:** If no response in 120 seconds, show error: "Generation is taking longer than expected. Tap to retry or cancel."

**Implementation note:** The API is a long-polling HTTP request (not streaming). Use `axios` with `timeout: 180_000`.

---

### Session Result Screen (`app/session/[sessionId].tsx`)

Receives either `sessionId` (from vault) or the full session object as navigation params.

#### Header Section
```
S-M9V4  [SAVED] badge
U14 Boys · Intermediate · 60 min
Pressing · Middle Third

Skill Focus:
[Compactness] [High Press] [Trigger Moments]
```

#### Drill List (Accordion)
Each drill rendered by `DrillAccordionItem`:

**Collapsed state:**
```
▶  Warmup — Rondos        10 min   [Phase badge]
```

**Expanded state:**
```
▼  Rondos 4v2              15 min   [Technical]
   ┌─────────────────────────────┐
   │       [SVG Diagram]         │  120px tall, tap = fullscreen
   └─────────────────────────────┘
   4 attackers, 2 defenders in...
   [Read full setup →]            ← navigates to drill detail
```

Only one accordion item open at a time (others collapse on open).

#### Sticky Bottom Nav
```
W  R  T  P  C  G
   ●               ← current drill indicator
```
Letters abbreviate drill names. Tapping jumps the accordion to that drill.

#### Action Bar (above bottom tab bar)
```
[🗃️ Save]  [📄 PDF]  [📅 Schedule]  [💬 Coach Chat]
```

- **Save:** Calls `POST /vault/sessions/:id/save`. Icon fills on save, shows "Saved" toast. Tap again to unsave.
- **PDF:** Calls `POST /ai/export-session-pdf` → opens share sheet with PDF file.
- **Schedule:** Opens `ScheduleSessionModal` (bottom sheet date/time picker).
- **Coach Chat:** Opens `ChatModal` with session context pre-loaded.

---

### Drill Detail Screen (`app/session/drill/[drillId].tsx`)

Three tabs:

#### Tab 1: Setup
```
[Large SVG Diagram — tap to fullscreen]

Duration: 15 min
Players: 6–8

Organization
────────────
[Full organization text — no truncation]

Key Rules
────────────
• Rule 1
• Rule 2
```

#### Tab 2: Coaching Points
```
Coaching Points
────────────────
1  Body shape when pressing
2  Trigger on back pass
3  Compactness in shape
4  First defender angle
5  Recovery position after press
6  Goalkeeper as 11th player

Psychology Angle
────────────────
[coaching psychology note if available]
```

#### Tab 3: Progressions
```
Progression 1
─────────────
[Description]

Progression 2
─────────────
[Description]

Progression 3
─────────────
[Description]
```

---

### Diagram Fullscreen Modal

Triggered by tapping any diagram thumbnail:

```
┌─────────────────────────────┐
│                        [✕] │
│                             │
│                             │
│    [Full SVG — pinch zoom]  │
│                             │
│                             │
│  Drill: Rondos 4v2 · 15min  │
│  [View full drill details]  │
└─────────────────────────────┘
```

**Gestures:**
- Pinch to zoom (min 1x, max 4x)
- Pan when zoomed in
- Double-tap to reset zoom
- Swipe down to dismiss

Uses `react-native-gesture-handler` + `react-native-reanimated`.

---

### Coach Chat Modal

Bottom sheet with 60% screen height, expandable to full.

```
┌─────────────────────────────┐
│  Coach Assistant  [✕]       │
│─────────────────────────────│
│                             │
│  [AI] Hi! I'm looking at    │
│  session S-M9V4. What would │
│  you like to know?          │
│                             │
│  [User] Can you suggest a   │
│  harder regression for      │
│  the pressing drill?        │
│                             │
│  [AI] For the pressing      │
│  trigger drill, try...      │
│                             │
│─────────────────────────────│
│  [Type message...]     [→]  │
└─────────────────────────────┘
```

**API:** `POST /ai/chat` with `{ message, sessionRef: "S-M9V4" }`

Messages are stored in local state only (not persisted between app sessions in Phase 2).

---

### Drill Generation Form (`app/(tabs)/generate/drill.tsx`)

Simplified version of session form:
- Age Group
- Player Level
- Game Model
- Phase
- Zone
- Player count (one input)

**Generate button:** `[⚡ Generate Drill]`

**Result screen:** Single drill detail view (same `DrillTabView` component, no accordion needed).

---

### Series Generation Form (`app/(tabs)/generate/series.tsx`)

Same form as Session but adds:
- Number of sessions (2–8)
- Weeks between sessions (1–2)

**Feature gate:** Requires `canGenerateProgressiveSeries`. Show upgrade prompt if not available.

**Generation:** Takes longer (30–3 minutes). Progress screen shows per-session progress:
```
Session 1 of 4  ✓
Session 2 of 4  ✓
Session 3 of 4  ▓▓▓░░ generating...
Session 4 of 4  ○ waiting
```

---

## API Calls in This Phase

| Action | Method | Endpoint |
|---|---|---|
| Generate session | POST | `/ai/generate-session` |
| Generate drill | POST | `/ai/generate-drill` |
| Generate series | POST | `/ai/generate-progressive-series` |
| Cancel generation | POST | `/ai/cancel-generation` |
| Get session | GET | `/vault/sessions/:sessionId` |
| Save session | POST | `/vault/sessions/:sessionId/save` |
| Remove session | POST | `/vault/sessions/:sessionId/remove` |
| Save status | GET | `/vault/sessions/:sessionId/status` |
| Export PDF | POST | `/ai/export-session-pdf` |
| Export drill PDF | POST | `/ai/export-drill-pdf` |
| Coach chat | POST | `/ai/chat` |

---

## SVG Diagram Port

The `UniversalDrillDiagram` component from web (`apps/web/src/components/UniversalDrillDiagram.tsx`) needs porting to use `react-native-svg` instead of browser SVG.

**Strategy:**
1. Move diagram type definitions to `packages/shared/src/types/diagram.ts`
2. Create `apps/mobile/components/diagram/UniversalDrillDiagram.tsx`
3. Replace `<svg>`, `<rect>`, `<circle>`, `<path>`, `<text>` tags with `react-native-svg` equivalents: `<Svg>`, `<Rect>`, `<Circle>`, `<Path>`, `<Text>`
4. All coordinate logic (pitch rendering, player positions, arrows) stays identical — only the JSX tags change

```typescript
// web version
import React from 'react';
export const UniversalDrillDiagram = ({ diagram }) => (
  <svg viewBox="0 0 800 600">
    <rect ... />
  </svg>
);

// mobile version
import { Svg, Rect, Circle, Path, Text } from 'react-native-svg';
export const UniversalDrillDiagram = ({ diagram }) => (
  <Svg viewBox="0 0 800 600">
    <Rect ... />
  </Svg>
);
```

---

## Testing Scenarios — Phase 2

### GEN-001: Session Generation — Happy Path

```
Steps:
1. Navigate to Generate tab → Session sub-tab
2. Select: Age=U14, Level=Intermediate, Model=Pressing, Phase=Attacking, Zone=Mid 3rd, Duration=60
3. Tap [Generate Session]
4. Assert: loading screen shown with progress animation
5. Assert: progress messages cycle every ~5 seconds
6. Wait for response (mock: return after 2 seconds in tests)
7. Assert: session result screen shown
8. Assert: session header shows correct age/level/model
9. Assert: skill focus tags shown
10. Assert: drill accordion shows all drills
11. Assert: action bar shows Save / PDF / Schedule / Chat

API mock: POST /ai/generate-session → full session JSON
```

---

### GEN-002: Session Generation — Usage Limit Reached

```
Steps:
1. Login as user with sessionCount=100, sessionLimit=100
2. Navigate to Generate → Session
3. Assert: Generate button is disabled
4. Assert: button text shows "Upgrade to generate more →"
5. Tap button
6. Assert: upgrade modal or Stripe portal link shown
7. Assert: no API call made

State: /auth/usage returns { sessionCount: 100, sessionLimit: 100 }
```

---

### GEN-003: Generation Cancel

```
Steps:
1. Start session generation
2. Loading screen appears
3. Tap [✕] cancel button
4. Assert: confirmation dialog: "Cancel generation?"
5. Tap [Cancel Generation]
6. Assert: POST /ai/cancel-generation called
7. Assert: user returned to generate form
8. Assert: no session saved

API mock: POST /ai/cancel-generation → 200
```

---

### GEN-004: Generation Network Timeout

```
Steps:
1. Start session generation
2. Mock: API request times out after 120 seconds
3. Assert: error message shown on loading screen
4. Assert: [Retry] and [Cancel] buttons shown
5. Tap [Retry]
6. Assert: new generation request started

API mock: delay 121 seconds → timeout error
```

---

### GEN-005: Generation API Error

```
Steps:
1. Start generation
2. Mock: API returns 500
3. Assert: error screen with message
4. Assert: [Try Again] button navigates back to form with form state preserved
5. Assert: all previous form selections retained

API mock: POST /ai/generate-session → 500
```

---

### DRILL-001: Accordion Interaction

```
Steps:
1. View session result with 6 drills (all collapsed)
2. Tap Drill 1 → Assert: Drill 1 expands, shows diagram + preview text
3. Tap Drill 2 → Assert: Drill 2 expands, Drill 1 collapses automatically
4. Tap Drill 2 again → Assert: Drill 2 collapses
5. Assert: only ever one drill expanded at a time
```

---

### DRILL-002: Drill Detail Tabs

```
Steps:
1. Tap [Read full setup →] on an expanded drill
2. Assert: navigated to DrillDetail screen
3. Assert: Setup tab shown by default with full organization text
4. Assert: SVG diagram visible in Setup tab
5. Tap [Coaching] tab → Assert: coaching points list shown (numbered)
6. Tap [Progressions] tab → Assert: progressions list shown
7. Tap [Setup] tab → Assert: returns to setup content
```

---

### DRILL-003: Diagram Fullscreen

```
Steps:
1. View drill detail (Setup tab)
2. Tap SVG diagram thumbnail
3. Assert: fullscreen modal opens with animation
4. Assert: diagram fills screen
5. Perform pinch-zoom gesture → Assert: diagram scales up (max 4x)
6. Double-tap → Assert: zoom resets to 1x
7. Swipe down → Assert: modal dismisses with animation
```

---

### DRILL-004: Sticky Drill Navigator Jump

```
Steps:
1. View session with 6 drills
2. Scroll to bottom — Assert: mini nav visible
3. Tap letter for Drill 4
4. Assert: scroll jumps to Drill 4 position
5. Assert: Drill 4 letter is highlighted in nav
6. Scroll manually back to top → Assert: nav updates to Drill 1 highlight
```

---

### SAVE-001: Save Session to Vault

```
Steps:
1. View newly generated session (not yet saved)
2. Assert: Save button shows empty bookmark icon
3. Tap [Save]
4. Assert: POST /vault/sessions/:id/save called
5. Assert: save icon fills immediately (optimistic update)
6. Assert: success toast "Session saved to vault"
7. Navigate away and back
8. Assert: GET /vault/sessions/:id/status → isInVault: true
9. Assert: save icon remains filled

API mocks:
  POST /vault/sessions/:id/save → 200
  GET /vault/sessions/:id/status → { isInVault: true }
```

---

### SAVE-002: Unsave Session

```
Steps:
1. View saved session (save icon filled)
2. Tap save icon
3. Assert: confirm dialog "Remove from vault?"
4. Tap [Remove]
5. Assert: POST /vault/sessions/:id/remove called
6. Assert: icon returns to empty (optimistic update)
7. Assert: toast "Removed from vault"

API mock: POST /vault/sessions/:id/remove → 200
```

---

### PDF-001: Export Session PDF

```
Steps:
1. View session result
2. Tap [PDF] in action bar
3. Assert: loading indicator shown on PDF button
4. Assert: POST /ai/export-session-pdf called with sessionId
5. Assert: loading resolves
6. Assert: native share sheet appears with PDF file
7. User can tap [Save to Files] or share via any app
8. Assert: no navigation change

API mock: POST /ai/export-session-pdf → binary PDF blob
```

---

### PDF-002: PDF Export — Not Permitted (FREE plan)

```
Steps:
1. Login as FREE user
2. View session result
3. Assert: PDF button is disabled or shows lock icon
4. Tap button → Assert: upgrade prompt shown

State: user features do not include canExportPDF
```

---

### CHAT-001: Coach Chat Basic Interaction

```
Steps:
1. View session result
2. Tap [Coach Chat] button
3. Assert: chat modal slides up from bottom
4. Assert: opening message references session ref code
5. Type: "Can you make the pressing drill harder?"
6. Tap [Send]
7. Assert: POST /ai/chat called with { message, sessionRef }
8. Assert: loading indicator in chat
9. Assert: AI response appended to chat
10. Assert: scroll to bottom of messages

API mock: POST /ai/chat → { reply: "For a harder pressing drill, try..." }
```

---

### SERIES-001: Progressive Series Generation

```
Steps:
1. Navigate to Generate → Series
2. Select: Age=U12, Level=Beginner, Model=Possession, Sessions=4, Weeks=1
3. Tap [Generate Series]
4. Assert: loading screen shows per-session progress
5. Wait for completion
6. Assert: series overview screen shown
7. Assert: 4 session cards listed
8. Assert: SR-XXXX reference code shown
9. Tap session 2 → Assert: opens session result screen for that session

API mock: POST /ai/generate-progressive-series → full series JSON with 4 sessions
```

---

### SERIES-002: Series — Feature Gate

```
Steps:
1. Login as FREE user
2. Navigate to Generate → Series tab
3. Assert: entire form is locked with upgrade prompt overlay
4. Assert: no form interaction possible

State: user features do not include canGenerateProgressiveSeries
```

---

### FORM-001: Form State Persisted Between Tabs

```
Steps:
1. Navigate to Generate → Session
2. Select Age=U16, Model=Pressing
3. Navigate to Vault tab
4. Navigate back to Generate tab
5. Assert: Age=U16 and Model=Pressing still selected
6. Assert: no form reset on tab navigation
```

---

## Acceptance Criteria for Phase 2

- [ ] All form fields work and match web app options
- [ ] Form state persists across tab navigation
- [ ] Form pre-fills from user preferences (AsyncStorage)
- [ ] Generation loading screen shows animated progress
- [ ] Progress messages cycle during loading
- [ ] Cancel button works and confirms before cancelling
- [ ] 120-second timeout shows retry option
- [ ] Session result shows accordion drill list
- [ ] Only one accordion item open at a time
- [ ] Drill detail tabs (Setup / Coaching / Progressions) all work
- [ ] SVG diagrams render correctly on iOS and Android
- [ ] Diagram fullscreen modal opens with pinch-zoom support
- [ ] Double-tap resets zoom, swipe-down dismisses
- [ ] Sticky mini-nav jumps to correct drill
- [ ] Save/unsave works with optimistic UI updates
- [ ] PDF export opens native share sheet
- [ ] PDF export disabled for FREE plan with upgrade prompt
- [ ] Coach chat modal works with session context
- [ ] Series generation shows per-session progress
- [ ] Series feature gate works for FREE users
- [ ] Usage limit blocks generation and shows upgrade prompt
- [ ] All screens support dark mode (zinc color scheme)
