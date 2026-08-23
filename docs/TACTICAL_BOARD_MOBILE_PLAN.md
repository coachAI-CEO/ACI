# Tactical Board — Native Mobile Plan

Make the tactical board first-class on the mobile app. Phases are sized
so each one ships as a working release — a coach can stop at any phase and
already have something useful.

The end state:

- **View + navigate** any board (already works — keeps working).
- **Create** a board (blank, from a session, from a drill).
- **Edit** the diagram with native touch tools — select/drag players,
  draw arrows, edit text, erase, etc.
- **Pitch format** controls (7v7 / 9v9 / 11v11 + orientation).
- **Multi-frame sequence** timeline with tween playback.
- **AI chat** for the board (text-only at first; image upload later).
- **Save / share / delete** — full CRUD parity with the web.

Each phase lists the goal, the deliverables, the moving parts (api/mobile
where they live), and the verification check on the simulator.

---

## Phase A — Type foundation + shared schema

**Goal**: stop passing `diagram: any` around. Hoist the `WebDiagramV1`
shape into `@aci/shared` so mobile and web consume the same types.

A1. Move `WebDiagramV1Schema` (or a normalized equivalent) into
    `packages/shared/src/types/board.ts`. Re-export the relevant
    zod-inferred TypeScript types (`DiagramV1`, `DiagramPlayer`,
    `DiagramArrow`, `DiagramElement`, `DiagramArea`, `DiagramLabel`,
    `DiagramFrame`, `DiagramSequence`).

A2. Drop zod from `@aci/shared` if it bloats the bundle. Prefer
    hand-written interfaces that match the API schema field-for-field
    (and add a runtime test against the API to catch drift).

A3. `apps/mobile/services/boards.service.ts` adopts the shared types —
    `BoardDetail.diagram` is `DiagramV1 | null`, no more `any`.

A4. `apps/mobile/components/boards/BoardPreview.tsx` types its props via
    `DiagramV1` and `DiagramFrame`.

A5. Web does the same — replace the local `@/types/diagram` with imports
    from `@aci/shared` for the shape types (keep the local helpers for
    geometry/layout).

A6. `pnpm tsc --noEmit` clean across mobile + web.

**Verify**: TypeScript compiles in both apps. The existing board viewer
renders identically (regression check).

---

## Phase B — List + create flow

**Goal**: a coach can land on `/boards`, search their boards, see the
share-mode filter, paginate, and create a new board.

B1. Update `apps/mobile/services/boards.service.ts`:
    - `createBlankBoard(payload)` → `POST /boards` with `{ mode: 'BLANK' }`
    - `createBoardFromSession(sessionId)` → `POST /boards` with
      `{ mode: 'FORK_SESSION', sourceSessionId }`
    - `createBoardFromDrill(...)` → `POST /boards` with `{ mode: 'FORK_DRILL' }`
    - `deleteBoard(id)` → `DELETE /boards/:id`
    - `patchBoard(id, body)` → `PATCH /boards/:id` (for shareMode etc.)

B2. Update `BoardListItem` to include `shareMode`, `updatedAt`,
    `canEdit`, and a `boardSummary` (the rich card metadata the web
    summary uses: phase / zone / attFormation / defFormation).

B3. Rewrite `apps/mobile/app/boards/index.tsx`:
    - Search field (debounced, calls `listBoards` with a `q` filter if the
      API supports it; otherwise client-filter).
    - Share-mode filter chips (All / Private / Club).
    - Infinite scroll via `nextCursor`.
    - **Create** menu — `PickerSheet` with three rows:
      Blank board · From a session · From a drill. Each opens a small
      sub-flow.
    - Long-press on a board → Delete confirm (only when `canEdit`).

B4. Add a "Boards" empty state with the same quick-create menu.

B5. Mirror the web's `MyBoardsPanel` card layout — show the
    `boardSummary` chips (phase / zone / att / def formation) on each
    row so coaches can scan without opening.

B6. The Quick Actions "Boards" tile and Settings row keep pushing
    `/boards`. No new entry points yet (that's Phase C).

**Verify**: typecheck, simulator — log in as `11v11.coach@rocklinfc.org`,
land on `/boards`, create a blank board, see it in the list, paginate.

---

## Phase C — Editor v1: read-mode fidelity

**Goal**: the `/boards/[id]` screen reads like the web editor's read mode
— pitch chrome is accurate to format (7v7/9v9/11v11), zones/thirds are
shown, and frame timeline + dots are styled like the web.

C1. Port `apps/web/src/lib/pitch-formats.ts` into
    `apps/mobile/lib/pitch-formats.ts`. Pull `PITCH_SPECS`,
    `PITCH_FORMAT_OPTIONS`, `formatFromAgeGroup`. Add a sibling
    `formatFromBoard(board)` that prefers the explicit
    `board.diagram.pitch.format` and falls back to
    `formatFromAgeGroup(board.ageGroup)`.

C2. Extract a reusable `<PitchChrome>` component
    (`apps/mobile/components/boards/PitchChrome.tsx`) that renders the
    pitch outline, center line, center circle, penalty box, goal, thirds
    (when `showThirds`), zones (when `showZones`), and build-out lines
    (7v7). Uses `react-native-svg` with a `viewBox="0 0 100 N"` where
    `N = 100 × lengthYards / widthYards` to preserve aspect ratio.

C3. Rewrite `BoardPreview.tsx`:
    - Determine `format` from board → `formatFromBoard`.
    - Determine `orientation` (`HORIZONTAL` / `VERTICAL`) from the
      diagram; default `HORIZONTAL`.
    - Render `<PitchChrome>` underneath, then players, then arrows,
      then labels (with the existing color rules).
    - Add token rings for `number` and `role` (the web renders both when
      `labelStyle === 'number-and-role'`).
    - Respect `coach`, `goals`, `balls`, `cones`, `elements`
      (mini-goal/cone/mannequin/pole).
    - Add a light "areas" pass (rect / circle / spotlight) using SVG
      primitives.

C4. Frame timeline:
    - Replace the existing dot row with a horizontal sequence bar
      (`<BoardSequenceBar>`) that mirrors the web component — title
      chips, dot indicator, prev/next + autoplay toggle. Tap a frame to
      jump. Auto-play advances every `frame.durationMs`.
    - Show frame `note` inline below the pitch.

C5. Pitch format / orientation toolbar in the header:
    - Format: `7v7` / `9v9` / `11v11` segmented control. Changing it
      reformats the rendered pitch but does not mutate the saved diagram
      (web behaviour — the format is determined from `ageGroup` on
      save).
    - Orientation: `Horizontal` / `Vertical` segmented control.

C6. Pitch zoom: `Full` / `Half` / `Third` segmented control. Zoom is
    rendered by clipping the SVG with a viewBox or wrapping in a scroll
    view. Pan is not needed at this stage.

C7. Add a `canEdit` badge + a prominent "Edit" CTA in the header that
    either opens the native editor (Phase D) when `canEdit` or deep-links
    to web otherwise.

C8. Read-only view: long-press to copy a share link, save board image
    to camera roll (use `react-native-view-shot` or equivalent).

**Verify**: open the existing 11v11 board on the simulator, verify the
pitch chrome matches the web (penalty box size, center circle), switch
between frame slides, toggle auto-play, change orientation.

---

## Phase D — Editor v2: native editing

**Goal**: a coach can edit the diagram with their thumb — no "Edit on web"
button.

D1. Editor screen `apps/mobile/app/boards/[id]/edit.tsx`. Mounted under
    `Stack.Screen` with header "Edit board". Hidden behind
    `canEdit` gate; read-only boards redirect back.

D2. New `<BoardCanvas>` component
    (`apps/mobile/components/boards/BoardCanvas.tsx`):
    - Wraps the SVG with `PanGestureHandler` + `PinchGestureHandler` for
      pan + zoom (single-finger pan, two-finger pinch zoom; double-tap
      resets).
    - Reuses `<PitchChrome>` + the player/arrow rendering from C3.
    - Tap-to-select: tapping a player/arrow/label selects it. Selected
      entities get a halo outline and drag handles.
    - Drag-to-move for players and label anchors.
    - Pinch/resize arrows by dragging their endpoints (a follow-up to
      D2; for v1, arrows are placed by tap-tap).

D3. Tool palette (`<BoardToolPalette>`):
    - Bottom sheet (or top header) showing the same 17 tools the web
      exposes, but bundled into 5 buttons + a "More" sheet:
        1. **Move** (V)
        2. **Player** (P) — tap-to-place; cycle `ATT` / `DEF` /
           `NEUTRAL` via a team pill above the palette
        3. **Arrow** (submenu: pass / run / press / cover / transition)
           — tap first entity, tap second entity
        4. **Shape** (submenu: rect / circle / spotlight)
        5. **More** (sheet: ball, label, eraser, mini-goal, cone,
           mannequin, pole)
    - Active tool indicator + a "Done" pill to exit the tool.

D4. Bottom action row:
    - **Undo / Redo** (session-only — reset on save).
    - **Reset** (clear selection).
    - **Save** — primary button. PATCHes the board's full `diagram`.
    - **Save & exit** — save then pop back to detail.

D5. Pitch controls (format / orientation / zoom) live in the editor
    header (same components as read mode, C5/C6).

D6. Player details popover: tapping a player shows a small floating
    bubble with `Number` (0–99), `Role` (text), `Team` (ATT/DEF/NEUTRAL),
    and a delete button. Reuses a `Popover` or `Modal` we already have.

D7. Erase mode: tap to delete a player/arrow/area/label. Reuses the
    same selection-state plumbing as Move.

D8. Frame timeline moves into the editor too (read mode already has it).
    Editor gains + / duplicate / delete / rename frame affordances.

D9. Optimistic updates: the editor maintains a local `DiagramV1` and
    diffs on save. `PATCH /boards/:id` returns the canonical board, and
    we reconcile by replacing local state with the server's.

D10. Autosave on blur: when the editor screen unmounts without an
    explicit Save, if the diagram has uncommitted changes, prompt the
    coach with **Discard / Save & exit**. (A real autosave-on-tick is
    not in scope for v1.)

D11. Keyboard avoidance + safe area for the bottom palette.

**Verify**: typecheck, simulator — open a blank board, add a 4-2-3-1
attacking shape with two runs and one press, save, reopen on web, confirm
the diagram is identical.

---

## Phase E — Sequence timeline + playback

**Goal**: multi-frame animations on the phone, matching the web's
sequence bar behaviour.

E1. Lift `lib/board-sequence.ts` (web) into
    `packages/shared/src/board/sequence.ts`. Pure functions:
    `ensureSequence`, `syncActiveFrame`, `extractFrameLayers`,
    `interpolateLayers`, `duplicateActiveFrame`, `deleteActiveFrame`.
    No React.

E2. Editor's `<BoardSequenceBar>`:
    - + (add frame) / duplicate / delete / rename.
    - Tap to switch active frame.
    - Drag-to-reorder.
    - Per-frame `durationMs` slider (400–12000ms; web's allowed range).
    - **Play** button — advances frames using `setInterval` and
      interpolates layer positions with `BOARD_SEQUENCE_TWEEN_MS`
      interpolation.

E3. The tween uses the same `interpolateLayers` helper. Each player /
    arrow / label that differs between frames animates linearly over
    `tweenMs`. This is what the web already does.

E4. Editor header shows the active frame's title and `note`. Tap to
    edit inline.

E5. Frame `note` is shown beneath the canvas in read mode (existing
    behaviour) and above the timeline in edit mode.

**Verify**: open a 3-frame board, scrub manually, hit play, confirm
players move smoothly between frames.

---

## Phase F — AI chat for boards (text-only)

**Goal**: a coach can ask the board "show me a 4-2-3-1 press trigger from
the GK" and see the diagram update on the phone, with the same reply /
applied semantics the web has.

F1. `apps/mobile/services/boards.service.ts`:
    - `sendBoardAiChat(boardId, payload)` → `POST /boards/:id/ai-chat`
    - Returns `{ reply, applied, diagram, sessionBridge? }`.
    - `history` is passed through so the mobile mirrors the web's last-8
      message window.

F2. `<BoardAiSheet>` (bottom sheet) mounted on the detail screen and the
    editor. Composer at the bottom with `KeyboardAvoidingView`. History
    bubbles (assistant replies can carry an `applied: true` badge).

F3. The reply's `applied: true` carries an updated `diagram`. On tap of
    "Apply", replace the local diagram with the AI's. In read mode this
    triggers a "Tap Apply to see changes" preview overlay (the AI's
    diagram shown ghosted) — Apply is the confirm.

F4. `sessionBridge` carries the "build this into a session" deep link.
    Surface it as a card below the AI reply with a CTA that opens the
    Generate form hydrated from `generatorUrl` (Phase B already wired
    `hydrateFromHref` for this).

F5. Welcome message mirrors the web's `welcomeForFormat(format)` — a
    short suggestion tailored to the board's pitch format.

F6. Optimistic insertion: insert the user's message immediately, show an
    inline "CoachAI thinking…" indicator, then append the assistant
    reply.

F7. Read-only boards hide the composer — show "View-only — open on web to
    chat" instead.

**Verify**: open an 11v11 board on mobile, send "show me a 4-3-3 build-up
with a #6 dropping between the CBs", confirm the reply carries a
diagram, Apply updates the board, the server returns the same diagram on
GET.

---

## Phase G — Share, delete, polish

**Goal**: parity with the web's sharing model + small polish items.

G1. Share mode toggle (Private / Club) in the editor's overflow menu.
    PATCH the board on change.

G2. Delete board action with confirm dialog. Available only when
    `canEdit`. Empty state after delete bounces back to `/boards`.

G3. "Edit on web" CTA moves into a Settings/overflow menu on mobile (no
    longer the primary CTA).

G4. Boards feature gate (`features.tacticalBoardV1`) on the client:
    - `/boards` empty state for disabled accounts points to a "Boards
      coming soon" copy + the Settings row to view features.
    - The Quick Actions "Boards" tile reads muted when disabled.
    - The Vault session detail "Tactical board" CTA hides when disabled.

G5. Offline cache: extend `useOfflineVault` to include the user's own
    boards so they remain viewable when the API is unreachable.

G6. Empty-state: if a coach has zero boards, the home tile surfaces a
    "Create your first board" deep link instead of just opening the
    listing.

G7. Performance: `BoardPreview` and `BoardCanvas` should memoize their
    rendering by diagram `updatedAt` so re-renders during a swipe don't
    blow the SVG layer cache.

G8. Documentation: extend `docs/TACTICAL_BOARD_MOBILE_PLAN.md` with any
    gaps discovered in implementation; update `docs/release-process.md`
    to note that mobile now edits boards directly.

**Verify**: typecheck, lint clean, screenshot every screen, run the
offline test path (airplane mode → still see board, read-only).

---

## Phase H — Coach Center + Vault cross-links (later)

Not required for v1, but worth tracking once the editor ships.

- Coach Center team detail → "Boards for this team" section (needs the
  backend to filter boards by `teamId`).
- Vault session detail → "Open board in editor" deep link (when the
  board exists for the session, jump straight to `/boards/[id]/edit`).
- Player plan / Game day pack → embed board PNG export.
- Team picker (Phase I of the Coach Center plan) — boards listing should
  also filter by team when there is more than one.

---

## Open questions for review

1. **Save model**: do we ship autosave-on-tick (network on every edit) or
   explicit Save only? Mobile networks are flakier than desktop; explicit
   Save with a discard-on-exit prompt is the safer default but feels
   clunky on a phone.
2. **Pitch chrome at 7v7**: build-out lines are vertical thirds on the
   small-format pitch. Worth drawing them, or do they make the canvas
   too busy?
3. **Image / PDF upload to AI chat**: web supports both. Defer to a
   follow-up or include in Phase F? Image upload needs
   `expo-image-picker` (already in the bundle). PDF needs
   `expo-document-picker`.
4. **What to call "view mode" vs "edit mode"**: web treats the board page
   as both view + edit (the toolbar is always visible). Mobile splits
   them across two routes. Stick with that, or collapse into a single
   route with a "Done" button?
5. **Coach-level gating**: the web `BoardAiReply` already uses
   `coachLevel` / `playerLevel` to tune the AI voice. Mobile should
   surface those on the chat sheet, but should we show them inline as a
   small badge, or hide them entirely?

---

## Estimated scope

- **A** (types): 0.5 day
- **B** (list + create): 1 day
- **C** (read-mode fidelity): 1 day
- **D** (native edit): 2–3 days
- **E** (sequence + playback): 0.5–1 day
- **F** (AI chat): 1 day
- **G** (polish): 1 day

Total: ~7–9 working days, depending on how much polish we want. Each
phase is shippable on its own.

---

## What stays on web for now

- **PDF export** of the board — web-only for the foreseeable future
  (web uses `jsPDF` + `html2canvas`). Mobile just renders the SVG;
  sharing the rendered image is the closest analog.
- **Principles panel** — the mobile AI chat uses the same prompts but
  doesn't render the principles pane. Coaches who want the principles
  text still go to web.
- **Multi-board AI chat** — web lets you chat across multiple boards.
  Mobile stays single-board for v1.
- **Fork from drill with `sourceDrillKey`** — the API supports it, the
  mobile UI surfaces "From a drill" in Phase B but the drill picker is
  the Vault drill list; the picker itself is read-only on mobile today.
  Defer the rich picker until drill list grows.