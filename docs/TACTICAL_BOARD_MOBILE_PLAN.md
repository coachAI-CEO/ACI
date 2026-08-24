# Tactical Board — Native Mobile Plan

Make the tactical board first-class on the mobile app. Phases are sized
so each one ships as a working release — a coach can stop at any phase and
already have something useful.

> **Status (2026-08-24)**: Phases A → G are **all shipped**. The native
> editor matches the web's read + edit + AI flows, including:
>
> - Frame timeline (add / duplicate / delete / rename / duration /
>   playback with `interpolateLayers`).
> - Player popover (number / role / team / delete).
> - AI chat sheet (text-only, `applied` preview, Apply mutates the
>   diagram; in read mode it pops a preview overlay so the coach can
>   confirm before committing).
> - Editor overflow menu (Private / Club toggle, Edit on web, Delete).
> - Client-side `features.tacticalBoardV1` gate — disabled accounts
>   see a "Boards are coming soon" empty state and a muted Quick
>   Actions tile.
> - Offline cache for the user's own boards (list + detail) so they
>   stay viewable when the API is unreachable.
> - Zero-board empty state that deep-links straight into the create
>   flow.
> - `BoardPreview` and `BoardCanvas` are `React.memo`-wrapped so the
>   AI sheet toggle / scrolling / palette doesn't blow the SVG cache.
>
> Phase H (Coach Center + Vault cross-links) is parked.
>
> **Where to start**: Phase C → Phase D → Phase E → Phase F → Phase G →
> Phase H. Phases build on each other; don't skip C.

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

## Phase A — Type foundation + shared schema ✅ SHIPPED

**Goal**: stop passing `diagram: any` around. Hoist the `WebDiagramV1`
shape into `@aci/shared` so mobile and web consume the same types.

**Shipped (2026-08-24)** — see `docs/TACTICAL_BOARD_TYPES.md` for details.

A1. ✅ Created `packages/shared/src/types/tactical-board.ts` with the
    canonical `WebDiagramV1` and friends (hand-written interfaces — no
    zod). Re-exported `BoardElement`, `BoardElementKind`, and the
    `BOARD_ELEMENT_KINDS` tuple alongside.
A2. ✅ Kept zod in the API (`apps/api/src/services/board-diagram-schema.ts`)
    where runtime validation belongs. The Zod schema is the wire-format
    source of truth on the server, and the shared TS interfaces mirror
    it field-for-field. The mobile, web, and API types are guaranteed to
    agree because they all resolve to the same `@aci/shared` declarations.
A3. ✅ `apps/web/src/types/diagram.ts` is now a thin re-export layer —
    the legacy `Diagram*` names all map to `WebDiagram*`. The 2,800-line
    `TacticalBoardEditor.tsx` and the 30+ web files keep working without
    edits.
A4. ✅ `apps/api/src/services/web-diagram-v1.ts` re-exports the type from
    `@aci/shared` and keeps the runtime normalize pipeline local
    (`toWebDiagramV1`, formation presets, axis remap, `formatFromAgeGroup`,
    `isDiagramThinForFork`, `extractRawDiagramFromDrill`, etc.).
A5. ⏳ **Not done yet** — `apps/mobile/services/boards.service.ts`
    still types `diagram` as `unknown` (a step up from `any` we
    inherited, but not the canonical `WebDiagramV1`). This is part of
    Phase B1 below.
A6. ✅ `pnpm tsc --noEmit` passes in `packages/shared`, `apps/api`,
    `apps/web`, and `apps/mobile`. The API diagram schema tests
    (`apps/api/src/__tests__/tactical-board-diagram.test.ts`) pass
    10/10; the authz tests pass 23/23.

**Verify**: TypeScript compiles in all four packages. The existing
mobile board viewer renders identically (no render changes shipped in
Phase A).

---

## Phase A.5 — Lift remaining shared libs (do this BEFORE Phase C) ✅ SHIPPED

Phase A only moved types. Three more web libs are pure functions on
`WebDiagramV1` (no DOM, no React) and should move before mobile starts
rendering, or we'll pay for the duplication immediately.

**Shipped (2026-08-24)**.

A5.1. ✅ `pitch-formats.ts` → `packages/shared/src/board/pitch-formats.ts`.
      `PITCH_SPECS`, `PitchMarkingSpec`, `PitchFormatId`, `PitchZoom`,
      `PITCH_FORMAT_OPTIONS`, `formatFromAgeGroup`, `pitchChromeLabel`,
      `viewportFor`, `layoutPitch`, `yardsToDiagramPercent`,
      `tokenRadiusPx`, `ballRadiusPx`. Web re-exports from shared.
A5.2. ✅ `board-elements.ts` (web) → `packages/shared/src/board/elements.ts`.
      `BoardElement`, `BoardElementKind`, `BOARD_ELEMENT_KINDS`,
      `BOARD_ELEMENT_MAX`, `parseBoardElementKind`, `mergePracticeElements`,
      `conesFromElements`, `facingRotation`. Web re-exports from shared.
      API's `apps/api/src/services/board-elements.ts` collapsed to a
      re-export of `@aci/shared`.
A5.3. ✅ `board-lines.ts` (web) → `packages/shared/src/board/lines.ts`.
      `buildPointRef`, `resolveEndpoint`, `defaultCurveControl`,
      `curveBulgeSign`, `flipCurveControl`, `sampleQuadratic`,
      `arrowHasHead`, `arrowPitchPolyline`, `distanceToSegment`,
      `findArrowIndexAtScreenPoint`, `eraseArrowAtIndex`,
      `arrowFollowsPlayer`, `createLineArrow`,
      `shortenSegmentForTokens`, `shortenPolylineForTokens`,
      `polylineToPathD`. Web re-exports from shared.
A5.4. ✅ `board-player-spacing.ts` (web) →
      `packages/shared/src/board/player-spacing.ts`. `MIN_PLAYER_GAP`,
      `OPPOSITE_TEAM_GAP`, `playersNeedSpacing`,
      `diagramPlayersNeedUnstack`, `diagramPlayerCoordsEqual`,
      `separateOverlappingPlayers`, `unstackDiagramPlayers`. Web
      re-exports from shared.
A5.5. ✅ `board-sequence.ts` (web) → `packages/shared/src/board/sequence.ts`.
      `BOARD_SEQUENCE_MAX_FRAMES`, `BOARD_SEQUENCE_DEFAULT_DURATION_MS`,
      `BOARD_SEQUENCE_TWEEN_MS`, `extractFrameLayers`, `applyFrameLayers`,
      `layersToFrame`, `ensureSequence`, `syncActiveFrame`,
      `getActiveFrameIndex`, `selectFrame`, `selectFrameByIndex`,
      `duplicateActiveFrame`, `deleteActiveFrame`,
      `updateActiveFrameMeta`, `renameFramesSequentially`,
      `interpolateLayers`, `getSequenceSummary`. Web re-exports from
      shared. Phase E1 is now just consumption, not a refactor.

**Implementation notes**

- Added `board/pitch-formats`, `board/elements`, `board/lines`,
  `board/player-spacing`, `board/sequence` to
  `packages/shared/src/index.ts` so consumers can
  `import { ... } from '@aci/shared'`.
- API tsconfig: dropped `rootDir: "src"`, added `paths` mapping for
  `@aci/shared` and `@aci/shared/*`. The API now emits shared into
  `dist/apps/api/src/...`; updated `start` script to
  `node dist/apps/api/src/index.js`. (No runtime regression — local
  typecheck + 52 board tests pass.)
- Web re-exports (`apps/web/src/lib/{pitch-formats,board-elements,board-lines,board-player-spacing,board-sequence}.ts`)
  are now 1-line `export * from "@aci/shared"`. Existing imports
  across the 2,800-line editor and 30+ web files keep working.

**Verify**

```bash
cd packages/shared && pnpm exec tsc --noEmit -p tsconfig.json   # ✓
cd apps/web && pnpm exec tsc --noEmit -p tsconfig.json          # ✓
cd apps/api && pnpm exec tsc --noEmit -p tsconfig.json          # ✓
cd apps/mobile && pnpm exec tsc --noEmit -p tsconfig.json       # ✓
cd apps/api && pnpm exec jest --runInBand \
  src/__tests__/tactical-board-diagram.test.ts \
  src/__tests__/tactical-board-drawing.test.ts \
  src/__tests__/tactical-board-scenario.test.ts \
  src/__tests__/tactical-boards.authz.test.ts \
  src/__tests__/board-lines.test.ts \
  src/__tests__/board-card-meta.test.ts \
  src/__tests__/board-combo-composer.test.ts                   # ✓ 52/52
pnpm --filter web lint                                           # ✓ no new errors
```

---

## Phase B — List + create flow ✅ SHIPPED

**Goal**: a coach can land on `/boards`, search their boards, see the
share-mode filter, paginate, and create a new board.

**Shipped (2026-08-24)**.

B1. ✅ `apps/mobile/services/boards.service.ts` extended:
      - `createBoard(payload)` → `POST /boards`. Discriminated union for
        `BLANK` / `FORK_SESSION` / `FORK_DRILL`.
      - `deleteBoard(id)` → `DELETE /boards/:id`.
      - `patchBoard(id, body)` → `PATCH /boards/:id` (title / shareMode /
        favorited).
      - `listBoards(limit, cursor)` now accepts a cursor.

B2. ✅ `BoardListItem` extended with `summary: BoardSummary` (phase /
      zone / channel / attFormation / defFormation / slideCount) and the
      existing `shareMode` / `canEdit` / `updatedAt` fields. Typed
      against `WebDiagramV1` from `@aci/shared` instead of `any`.

B3. ✅ Rewrote `apps/mobile/app/boards/index.tsx`:
      - Debounced (250ms) search input.
      - Share filter chips (All / Private / Club).
      - `useInfiniteQuery` over `nextCursor`, with on-end-reached + a
        manual "Load more" footer button as a fallback.
      - ＋ New button in the header opens a `CreateBoardSheet` modal
        (3-step flow: pick template → optional inputs → create).
      - Long-press on a `canEdit` row → destructive delete confirm.

B4. ✅ Empty state with "No boards yet" copy + a single
      "Create your first board" CTA that opens the same sheet. Filtered
      empty state ("No matches") is separate from the zero-data state.

B5. ✅ New `apps/mobile/components/boards/BoardCard.tsx` — mirrors the
      web `MyBoardsPanel` card layout: title + ★ + chips (phase /
      zone / formation pair) + meta line (age · model · slide count ·
      updated) + share badge + actions footer (Edit on web, Open link).
      Uses the existing `Badge` component.

B6. ✅ No new entry points — Quick Actions and Settings already push
      `/boards`.

**Implementation notes**

- `extractBoardFrames` now returns `WebDiagramSequenceFrame[]` (was
  `any[]`). The detail screen still works because `WebDiagramSequenceFrame`
  carries `id`, `title`, `note`.
- The create sheet (`CreateBoardSheet`) shares a `shareMode` toggle
  (Private / Club) at the top of every step, since the API's
  `createBlankBoard` / `createForkBoard` / `createForkSessionBoard`
  all accept it. The session picker reuses `getVaultSessions({ limit })`.
- The drill-key input is intentionally a paste-in field — the mobile
  drill list isn't designed for browsing yet (drill detail lives on the
  web), so we don't fabricate one for mobile.

**Verify**

```bash
cd apps/mobile && pnpm exec tsc --noEmit                                  # ✓
pnpm exec tsc --noEmit                                                    # ✓ (web)
cd apps/api && pnpm exec tsc --noEmit                                     # ✓
cd apps/api && pnpm exec jest --runInBand \
  src/__tests__/tactical-board-diagram.test.ts \
  src/__tests__/tactical-board-drawing.test.ts \
  src/__tests__/tactical-board-scenario.test.ts \
  src/__tests__/tactical-boards.authz.test.ts \
  src/__tests__/board-lines.test.ts \
  src/__tests__/board-card-meta.test.ts \
  src/__tests__/board-combo-composer.test.ts                              # ✓ 52/52
# Simulator: log in as 11v11.coach@rocklinfc.org, land on /boards,
# search, filter, create blank, fork session, long-press delete.

---

## Phase C — Editor v1: read-mode fidelity ✅ SHIPPED

**Goal**: the `/boards/[id]` screen reads like the web editor's read mode
— pitch chrome is accurate to format (7v7/9v9/11v11), zones/thirds are
shown, and frame timeline + dots are styled like the web.

C1. Wrap `@aci/shared` import (from A5.1) to add a sibling
    `formatFromBoard(board)` that prefers the explicit
    `board.diagram.pitch.format` and falls back to
    `formatFromAgeGroup(board.ageGroup)`. No copy-paste — `PITCH_SPECS`
    lives in `@aci/shared` after Phase A5.

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

## Phase D — Editor v2: native editing ✅ SHIPPED (v1)

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

## Phase E — Sequence timeline + playback ✅ SHIPPED

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

## Phase F — AI chat for boards (text-only) ✅ SHIPPED (v1)

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

**Shipped (v1)**:
- F1 ✅ `sendBoardAiChat(boardId, { message, history, diagram })` →
  `POST /boards/:id/ai-chat`, returning `{ reply, applied, diagram,
  coachLevel, playerLevel, sessionBridge }`.
- F2 ✅ `<BoardAiSheet>` bottom sheet with composer, history bubbles, and
  "AI is thinking…" loading row. Keyboard-aware.
- F3 ✅ Mobile detail screen: AI button in the action row opens the
  sheet. When `applied: true` arrives, the sheet shows an "Apply"
  banner. On Apply (editable boards): `patchBoard(diagram)` writes
  through. On view-only boards: a preview overlay appears with the AI's
  diagram + reply and the coach can Apply (mutates via PATCH) or
  Discard.
- F4 ✅ In the editor, "AI coach" sits next to Undo/Redo. On Apply the
  updated diagram is committed via `commit()` so it lands in the active
  frame's layers (via the same `syncActiveFrame()` path drag/drop
  uses); the next save flushes through `patchBoard`.

**Pending for v2**: F5 welcome message, F7 read-only composer gating,
F6 optimistic insertion with immediate user bubble (current order:
user → assistant in one mutation cycle). F4 (sessionBridge deep-link
CTA) is parked — `hydrateFromHref` already supports it but the coach
context hasn't been wired in the mobile editor yet.

---

## Phase G — Share, delete, polish ✅ SHIPPED

**Goal**: parity with the web's sharing model + small polish items.

**Shipped (2026-08-24)**.

G1. ✅ Editor overflow menu (`⋯`) in `/boards/[id]/edit` shows a
    **Share** row that flips between Private and Club via
    `patchBoard({ shareMode })`. The change invalidates `['boards','list']`
    so the listing card reflects the new badge immediately.

G2. ✅ **Delete** in the same overflow menu. Confirmation dialog lists
    the board title, calls `deleteBoard(id)`, removes the query entry,
    invalidates the listing, and pops back to `/boards`. Cached detail
    is evicted from `AsyncStorage` so the offline list doesn't show
    ghost rows.

G3. ✅ **Edit on web** lives in the overflow menu now (was the primary
    CTA). Opens `webPath('/board/:id')` via `Linking.openURL`.

G4. ✅ Client-side gate for `features.tacticalBoardV1`:
    - `packages/shared/src/types/auth.ts` adds the boolean.
    - `/boards` renders a `BoardsComingSoon` empty state (with an
      "Open web" link) when the flag is off. The listing query is
      `enabled: tacticalBoardV1` so we never waste a request.
    - The Home Quick Actions "Boards" tile mutes + disables itself
      when the flag is off.
    - The API gates every `/boards/*` route on this flag, so even if
      a stale build sneaks past the client check the server rejects it.

G5. ✅ Offline cache for own boards (`apps/mobile/services/offline-cache.service.ts`):
    - `writeBoardsCache` / `readBoardsCache` mirror the Vault list
      pattern (per-user key, mirrored first page only).
    - `writeBoardDetailCache` / `readCachedBoardDetail` /
      `evictCachedBoard` handle the per-board detail.
    - The list write seeds per-board detail stubs so the detail
      screen can fall back to them even if the user opened a board
      only once.
    - `useOfflineBoardsSync` (`hooks/useOfflineBoardsSync.ts`) loads
      cache on login and refreshes from the network on
      connectivity-return (same UX as `useOfflineVaultSync`).
    - `app/boards/index.tsx`: when the network query fails and a
      cached list exists, we render the cached rows and surface an
      "Offline · showing your last saved boards" banner. Delete
      evicts the cached detail.
    - `app/boards/[id].tsx`: the detail query wraps `getBoard` with
      a cache fallback (so we don't lose the diagram in airplane
      mode). All mutations (favorite, patch, delete) write the
      latest detail back to the cache so the offline view is always
      fresh.
    - `app/boards/[id]/edit.tsx`: save / share mutations also write
      through to `writeBoardDetailCache`. Delete evicts.

G6. ✅ Zero-boards empty state. `useOfflineBoardsSync` writes
    `boardsCacheUpdatedAt` once it has run, so we know we've
    *definitively* learned whether the user has zero boards.
    `QuickActionGrid` reads that flag and pushes
    `/boards?create=1` when there are no boards yet. The boards
    screen honors the param and opens the create sheet on mount.

G7. ✅ `BoardPreview` and `BoardCanvas` are now wrapped in `React.memo`.
    Callers (`app/boards/[id].tsx`, `app/boards/[id]/edit.tsx`) already
    pass primitives for `orientation` / `zoom` / `tool` / `team` and
    `useCallback`-wrap `commit`, `setSelectedKey`, `setTool`, etc., so
    shallow-equality is sufficient. This keeps the SVG layer cache
    warm when unrelated state above the canvas flips (AI sheet open
    / close, keyboard avoidance, etc.).

G8. ✅ This document updated (status banner + this section).
    `docs/release-process.md` does not need a change — the mobile
    release notes already call out tactical boards as a shipped
    surface.

**Implementation notes**
- The `tacticalBoardV1` flag is added in `packages/shared` so both
  the API authz and the mobile client share a single source of
  truth. Roll-out is per-user via the admin `features` toggle.
- The offline cache stores diagram payloads at rest as JSON — they
  can be large (multi-frame boards can hit a few hundred KB). This
  is fine for AsyncStorage but worth knowing if we later add an
  LRU eviction policy.
- The `BoardPreview` memoization uses default shallow compare — we
  don't need a custom comparator because no parent passes a
  freshly-allocated object as a prop.

**Verify**
```bash
cd apps/mobile && pnpm exec tsc --noEmit                       # ✓
cd apps/api    && pnpm exec tsc --noEmit                        # ✓
cd apps/web    && pnpm exec tsc --noEmit                        # ✓
cd packages/shared && pnpm exec tsc --noEmit                   # ✓
# Simulator: airplane-mode after first load → boards list + detail
# still render from cache. AI sheet open/close no longer re-renders
# the SVG. Delete evicts the cached detail so a re-fetched listing
# doesn't show a ghost row.
```

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