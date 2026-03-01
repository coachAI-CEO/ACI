# Phase 4 — Video Analysis

> **Duration:** Week 8–9
> **Goal:** Coaches upload or record a short video clip, set tactical context, and receive AI-generated observations with diagram frames, severity ratings, and session recommendations. Results can be saved to the video vault and converted to corrective sessions.

---

## Deliverables

- [ ] Video tab with upload / camera recording support
- [ ] Tactical context form (age, level, model, phase, zone)
- [ ] Video analysis loading screen (longer wait — 60–180s)
- [ ] Analysis result screen: summary, observations, diagram frames
- [ ] Observation filtering by severity and category
- [ ] Diagram frames carousel
- [ ] Save analysis to video vault (`POST /vault/video-analysis/save`)
- [ ] Saved analyses list (`GET /vault/video-analysis`)
- [ ] Delete saved analysis
- [ ] Generate corrective session from analysis findings
- [ ] Generate corrective series from analysis findings
- [ ] Cached analysis detection (instant re-analysis of same video)

---

## File Structure for This Phase

```
app/
└── (tabs)/
    └── video.tsx                  Tab entry — upload + saved list

app/
└── video/
    ├── analysis/
    │   └── [analysisId].tsx       Analysis result view (from vault)
    └── result.tsx                 Fresh analysis result (from generation)

components/
├── video/
│   ├── VideoUploadCard.tsx        Upload area with camera/gallery buttons
│   ├── VideoContextForm.tsx       Age, level, model, phase, zone pickers
│   ├── VideoAnalysisLoading.tsx   Loading screen with longer wait UX
│   ├── AnalysisSummaryCard.tsx    Top-level summary + top priorities
│   ├── TeamDefinitionCard.tsx     Match format, formations, team colors
│   ├── ObservationList.tsx        Filtered observation list
│   ├── ObservationCard.tsx        Single observation (severity, cue, etc.)
│   ├── ObservationFilter.tsx      Filter by severity/category
│   ├── DiagramFrameCarousel.tsx   Swipeable tactical frames
│   ├── DiagramFrame.tsx           Single frame with positions + arrows
│   ├── SessionRecommendations.tsx Recommended training blocks
│   ├── SavedAnalysisCard.tsx      Card for saved analysis list
│   └── AnalysisActionBar.tsx      Save / Generate Session / Generate Series

services/
├── video-analysis.service.ts      run, save, getAll, delete

hooks/
├── useVideoAnalysis.ts            orchestrate upload + analysis request
└── useSavedAnalyses.ts            vault list + delete
```

---

## Screen Specifications

### Video Tab (`app/(tabs)/video.tsx`)

Two sections:

#### Upload Section (top half or full screen if no saved analyses)

```
┌──────────────────────────────────┐
│  Video Analysis                  │
│──────────────────────────────────│
│  ┌────────────────────────────┐  │
│  │                            │  │
│  │     🎥 Upload Video        │  │
│  │                            │  │
│  │  [📷 Camera]  [🖼️ Gallery] │  │
│  │                            │  │
│  │  MP4, MOV · Max 90 sec     │  │
│  └────────────────────────────┘  │
│                                  │
│  Context (optional)              │
│  ┌────────────────────────────┐  │
│  │ Age Group    [U14 Boys  ▾] │  │
│  │ Player Level [Interm.   ▾] │  │
│  │ Game Model   [Pressing  ▾] │  │
│  │ Phase        [Attacking ▾] │  │
│  │ Zone         [Mid 3rd   ▾] │  │
│  └────────────────────────────┘  │
│                                  │
│  [🔍 Analyze Video]              │
│──────────────────────────────────│
│  Saved Analyses (3)              │
│  [VA-Z8H1] U14 Match    Jan 20  │
│  [VA-P3K2] U12 Training Jan 15  │
│  [VA-Q9R3] U16 Game     Jan 10  │
└──────────────────────────────────┘
```

**Video picker (`expo-image-picker`):**
- Camera: `mediaTypes: ['videos']`, `videoMaxDuration: 90`
- Gallery: `mediaTypes: ['videos']`
- After selection: show video thumbnail preview with duration badge
- Allow re-selection: tap thumbnail to replace

**Permission handling:**
- Camera permission: request on first tap of [Camera]
- If denied: show settings deep-link prompt "Camera access required. Open Settings?"
- Media library permission: request on first tap of [Gallery]

**Context defaults:** Loaded from user preferences (AsyncStorage from Settings).

**Analyze button state:**
- Disabled if no video selected
- If video selected: `[🔍 Analyze Video]` (enabled)

**Feature gate:** Requires authenticated user. If FREE plan — button disabled with upgrade prompt. Validate against `GET /auth/me` features (video analysis should require COACH_BASIC+).

---

### Video Analysis Loading Screen

This takes significantly longer than session generation (60–180 seconds). UX must manage the wait carefully.

```
┌──────────────────────────────────┐
│                             [✕] │
│                                  │
│    [Video thumbnail preview]     │
│         ████████░░ 60%           │
│                                  │
│  Analyzing your footage...       │
│                                  │
│  ──────────────────────────────  │
│                                  │
│  🔍 Identifying team positions   │  ← animated dots while waiting
│  ✓  Detecting tactical shape     │  ← checkmark when done
│  🔍 Mapping movement patterns    │
│  ○  Generating observations      │  ← pending
│  ○  Building session plan        │
│                                  │
│  ──────────────────────────────  │
│                                  │
│  Video analysis uses advanced    │
│  AI and typically takes 1–3      │
│  minutes. Great time for a       │
│  water break! 💧                 │
│                                  │
└──────────────────────────────────┘
```

**Progress steps** (simulated UX — real progress not available from API):
1. "Uploading video..." (0–15%)
2. "Identifying teams and positions..." (15–35%)
3. "Detecting tactical patterns..." (35–55%)
4. "Analyzing 30+ observations..." (55–75%)
5. "Generating training recommendations..." (75–90%)
6. "Finalizing your analysis..." (90–100%)

Progress bar advances on a timer curve that slows down as it approaches 95% (never reaches 100% until API responds).

**Cancel:** Confirm dialog before cancelling (uploads can be large).

**Timeout:** After 240 seconds, offer: "This is taking longer than usual. Keep waiting or cancel?"

**Cached result:** If API returns immediately (cache hit), skip loading screen — navigate directly to result.

---

### Analysis Result Screen (`app/video/result.tsx`)

Tabbed layout to manage the volume of information:

**Header:**
```
VA-Z8H1  [SAVED] badge
U14 Boys · Pressing · Attacking · Mid 3rd
Analyzed Jan 20, 2026
```

**Tabs:**
```
[Summary]  [Observations (32)]  [Diagrams (10)]  [Plan]
```

---

#### Tab 1: Summary

```
Overall Assessment
──────────────────
Team A displayed solid high-press triggers but
struggled with recovery shape after transitions.

Video Quality: Good · 85% usable frames

Top Priorities
──────────────
1  ⚠️ CRITICAL  Defensive compactness after press
2  ⚠️ MAJOR     Ball-side pressing trigger timing
3  ⚠️ MAJOR     Goalkeeper positioning in press

Team Definition
──────────────
Format: 7v7
Team A: Red shirts · 4-2 formation
Team B: Blue shirts · 3-3-1 formation
```

---

#### Tab 2: Observations

Filter bar:
```
[All (32)]  [Critical (4)]  [Major (12)]  [Minor (16)]
[Technical] [Tactical] [Decision-Making] [Physical]
```

Observation card:
```
┌──────────────────────────────────┐
│  ⚠️ CRITICAL · Tactical          │
│  Defensive compactness           │
│──────────────────────────────────│
│  Team Focus: Team A · Conf: 0.91 │
│                                  │
│  Coaching Cue:                   │
│  "Maintain 4-meter spacing when  │
│  pressing to avoid gaps."        │
│                                  │
│  Micro-correction:               │
│  Trigger player must wait for    │
│  ball control before pressing.   │
│                                  │
│  U10 Adaptation:                 │
│  "Stay close to your partner     │
│  when the ball comes near."      │
│                                  │
│  Evidence: [Frame 3] [Frame 7]   │  ← tappable, opens diagram frame
└──────────────────────────────────┘
```

Observation cards stack in a scrollable list. Critical observations always shown at top regardless of filter.

---

#### Tab 3: Diagrams

Horizontal swipeable carousel of tactical frames:

```
Frame 3 of 10                [◀] [▶]
──────────────────────────────────
[SVG pitch diagram]
  ● ● ●    ← Team A players (red)
      ◎    ← ball
  ○ ○ ○    ← Team B players (blue)
  → →      ← movement arrows

Pressing trigger moment
Team A collapsing to ball side
```

Each frame:
- Has player positions (x,y from API)
- Has ball position
- Has movement arrows
- Has label/description
- Can be pinch-zoomed (same component as Phase 2)

Tapping a frame from Observations tab jumps to that frame number.

---

#### Tab 4: Plan

Session recommendations from analysis:

```
Recommended Training Focus
──────────────────────────

Priority 1  Pressing Compactness
            [Generate Drill →]

Priority 2  Trigger Timing Practice
            [Generate Drill →]

Priority 3  Recovery Shape After Press
            [Generate Drill →]

──────────────────────────────────
[⚡ Generate Corrective Session]
[📚 Generate Corrective Series (4 sessions)]
```

**Generate Corrective Session:**
- Calls `POST /ai/generate-session` with analysis findings injected into the prompt context
- Navigates to session result screen (Phase 2)

**Generate Corrective Series:**
- Same but for series
- Requires `canGenerateProgressiveSeries`

---

### Action Bar

Below tabs, fixed at bottom:

```
[💾 Save Analysis]  [⚡ Generate Session]  [📚 Generate Series]
```

**Save:** `POST /vault/video-analysis/save`
**Generate Session:** Pre-fill generate form with age/level/model from analysis context, add analysis findings as prompt injection.
**Generate Series:** Same for progressive series.

---

### Saved Analyses List (bottom of Video tab)

```
Saved Analyses (3)    [See all →]
──────────────────────────────────
┌────────────────────────────────┐
│ VA-Z8H1                  [🗑️] │
│ U14 Boys · Pressing            │
│ 32 observations · Jan 20       │
│ Top: Defensive compactness     │
└────────────────────────────────┘
```

Tap card → `app/video/analysis/[analysisId].tsx` (same layout as result screen, but data from vault).

Delete (🗑️) → confirm dialog → `DELETE /vault/video-analysis/:id` → animate card out.

**"See all →"** navigates to a full-screen list with same filtering as vault sessions.

---

## API Calls in This Phase

| Action | Method | Endpoint |
|---|---|---|
| Run analysis | POST | `/ai/video-analysis/run` |
| Save analysis | POST | `/vault/video-analysis/save` |
| List saved analyses | GET | `/vault/video-analysis` |
| Delete analysis | DELETE | `/vault/video-analysis/:id` |

**Request body for run analysis:**
```json
{
  "fileUri": "file:///path/to/video.mp4",
  "ageGroup": "U14_BOYS",
  "playerLevel": "INTERMEDIATE",
  "coachLevel": "USSF_C",
  "gameModelId": "PRESSING",
  "phase": "ATTACKING",
  "zone": "MIDDLE_THIRD"
}
```

Note: The API accepts a file URI. Use `expo-image-picker` result URI directly. For production, the API may need a pre-upload step — verify with backend.

---

## Testing Scenarios — Phase 4

### VIDEO-001: Video Selection from Gallery

```
Steps:
1. Navigate to Video tab
2. Tap [Gallery]
3. Assert: expo-image-picker gallery opens
4. Select a .mp4 video (< 90 seconds)
5. Assert: video thumbnail shown with duration badge
6. Assert: [Analyze Video] button becomes enabled

Mock: expo-image-picker returns { uri: "file:///video.mp4", duration: 45 }
```

---

### VIDEO-002: Video Selection from Camera

```
Steps:
1. Navigate to Video tab
2. Tap [Camera]
3. Assert: camera permission requested (if first time)
4. Record a short video
5. Assert: video thumbnail shown on return

Mock: expo-image-picker camera returns { uri: "file:///recorded.mov", duration: 30 }
```

---

### VIDEO-003: Camera Permission Denied

```
Steps:
1. Deny camera permission when prompted
2. Assert: settings prompt shown: "Camera access required"
3. Assert: [Open Settings] link shown
4. Assert: [Gallery] button still works

Mock: expo-image-picker → permission denied
```

---

### VIDEO-004: Analysis — Happy Path

```
Steps:
1. Select video
2. Set context: U14 Boys, Intermediate, Pressing
3. Tap [Analyze Video]
4. Assert: loading screen shown with progress steps
5. Assert: progress advances through all 5 steps with animations
6. Wait for mock response (2 seconds in test)
7. Assert: result screen shown with all 4 tabs
8. Assert: VA-XXXX ref code in header
9. Assert: Summary tab is default and shows top priorities
10. Assert: Observations tab shows count in label

API mock: POST /ai/video-analysis/run → full analysis JSON
```

---

### VIDEO-005: Analysis — Cached Response (Instant)

```
Steps:
1. Select same video as a previous analysis (same file URI)
2. Set same context parameters
3. Tap [Analyze Video]
4. Assert: loading screen shown briefly (< 1 second)
5. Assert: result screen appears quickly
6. Assert: [CACHED] badge or "From cache" note shown (if API indicates cache hit)

API mock: POST /ai/video-analysis/run → { ...analysis, cached: true } instantly
```

---

### VIDEO-006: Observation Filters

```
Steps:
1. View analysis result → Observations tab
2. Assert: "All (32)" tab selected by default
3. Tap [Critical (4)] filter
4. Assert: only 4 CRITICAL observations shown
5. Assert: all shown cards have "CRITICAL" badge
6. Tap [Tactical] category filter (with Critical still active)
7. Assert: intersection: only CRITICAL + TACTICAL observations shown
8. Tap [All] to reset
9. Assert: all 32 observations shown

Mock data: 4 critical (2 tactical, 2 technical), 12 major, 16 minor
```

---

### VIDEO-007: Diagram Frame Navigation

```
Steps:
1. View analysis result → Diagrams tab
2. Assert: Frame 1 of 10 shown
3. Swipe left → Frame 2 of 10
4. Tap [▶] next button → Frame 3
5. Tap [◀] prev button → Frame 2
6. Swipe to Frame 5 → pinch zoom
7. Assert: diagram scales up
8. Double-tap → zoom resets

Mock data: 10 frames with player positions
```

---

### VIDEO-008: Jump to Frame from Observation

```
Steps:
1. View Observations tab
2. Find observation with Evidence: [Frame 3] [Frame 7]
3. Tap [Frame 3] link
4. Assert: navigated to Diagrams tab showing Frame 3

Implementation: pass frameIndex to Diagrams tab on navigation
```

---

### VIDEO-009: Save Analysis to Vault

```
Steps:
1. View fresh analysis result (not saved)
2. Tap [Save Analysis] in action bar
3. Assert: POST /vault/video-analysis/save called
4. Assert: button shows "Saved" state (filled icon)
5. Navigate to Video tab
6. Assert: analysis appears in Saved Analyses list

API mock: POST /vault/video-analysis/save → { id, refCode: "VA-Z8H1" }
```

---

### VIDEO-010: Delete Saved Analysis

```
Steps:
1. View saved analysis card in Video tab
2. Tap [🗑️] delete icon
3. Assert: confirm dialog "Delete this analysis? This cannot be undone."
4. Tap [Cancel] → Assert: card still shown
5. Tap [Delete icon] again → confirm → tap [Delete]
6. Assert: DELETE /vault/video-analysis/:id called
7. Assert: card animates out of list
8. Assert: count updated: "Saved Analyses (2)"

API mock: DELETE /vault/video-analysis/:id → 200
```

---

### VIDEO-011: Generate Corrective Session from Analysis

```
Steps:
1. View analysis result → Plan tab
2. Tap [Generate Corrective Session]
3. Assert: navigates to session generation loading screen
4. Assert: POST /ai/generate-session called with analysis context injected
5. Wait for result
6. Assert: session result screen shown
7. Assert: session metadata matches analysis context (U14, Pressing)

API mock: POST /ai/generate-session → session tailored to analysis findings
```

---

### VIDEO-012: Feature Gate — Analysis Not Available

```
Steps:
1. Login as FREE user
2. Navigate to Video tab
3. Assert: [Analyze Video] button disabled
4. Assert: upgrade prompt shown: "Video analysis available on COACH_BASIC+"
5. Tap upgrade prompt
6. Assert: Stripe portal link opened in browser

State: user plan = FREE, canRunVideoAnalysis = false
```

---

### VIDEO-013: Video Too Long

```
Steps:
1. Tap [Gallery] and select a 3-minute video
2. Assert: error shown immediately: "Video must be 90 seconds or shorter"
3. Assert: video NOT added to upload area
4. Assert: [Analyze Video] button remains disabled

Implementation: validate duration from picker result before proceeding
```

---

### VIDEO-014: Analysis Network Failure

```
Steps:
1. Select video + set context
2. Disconnect device from network
3. Tap [Analyze Video]
4. Assert: error message shown on loading screen
5. Assert: [Retry] and [Cancel] options shown
6. Reconnect network, tap [Retry]
7. Assert: analysis restarts

Mock: POST /ai/video-analysis/run → network error
```

---

## Acceptance Criteria for Phase 4

- [ ] Video selection works from both camera and gallery
- [ ] Camera and media library permissions handled gracefully
- [ ] Video duration validated before analysis (max 90 seconds)
- [ ] Loading screen shows simulated progress steps with animations
- [ ] Cached responses skip the loading screen
- [ ] Result screen has all 4 tabs (Summary, Observations, Diagrams, Plan)
- [ ] Observations filter by severity and category (can combine)
- [ ] Diagram frames swipeable with pinch-zoom support
- [ ] Tapping a frame reference from an observation jumps to that frame
- [ ] Save analysis works and reflects in saved analyses list
- [ ] Delete analysis shows confirmation and animates card out
- [ ] Generate corrective session pre-fills context from analysis
- [ ] Feature gate blocks FREE users with upgrade prompt
- [ ] Network errors show retry option
- [ ] 240-second timeout prompts user to keep waiting or cancel
