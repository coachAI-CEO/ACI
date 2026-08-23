# Tactical Board — Mobile Inventory

What's already on the mobile app, what the web app does, and what the API
exposes. This is the starting point for the **native tactical board** plan.

---

## 1. What exists today on mobile

Two screens in `apps/mobile/app/boards/`:

- **`/boards`** (`apps/mobile/app/boards/index.tsx`) — a paginated list of the
  coach's boards (title, age, game model, phase, slide count). Each row has
  a `View` button (in-app) and `Edit on web` button (deep-links to the web
  editor). The screen is read-only and explicitly tells the user:
  > "View boards on phone. Edit on web for drawing tools."
- **`/boards/[id]`** (`apps/mobile/app/boards/[id].tsx`) — read-only viewer
  that renders the diagram's SVG via `BoardPreview`, supports paging through
  frames with a horizontal `ScrollView` + dot indicator, and toggles the
  `favorited` flag. Includes "Edit on web" and "Open source session"
  secondary buttons.

The shared viewer component (`apps/mobile/components/boards/BoardPreview.tsx`)
draws the pitch + players + arrows using `react-native-svg`. It accepts the
`WebDiagramV1` shape and resolves the active frame from
`diagram.sequence.frames[i]`. Players render as colored circles, lines as
straight `<Line>` primitives, label text as `<Text>`.

`apps/mobile/services/boards.service.ts` exposes:

- `listBoards(limit)` → `GET /boards` (cursor pagination via `nextCursor`)
- `getBoard(boardId)` → `GET /boards/:id`
- `setBoardFavorited(boardId, favorited)` → `PATCH /boards/:id`
- `extractBoardFrames(diagram)` — shared helper used by the viewer

Entry points to the boards surface:

- **Quick Actions grid** on the Home screen (`QuickActionGrid.tsx`) — row
  "Boards" pushes `/boards`.
- **Settings → Tools** → "Boards" row pushes `/boards`.
- **Vault session detail** → "Tactical board" / "View" via `/boards/[id]`
  deep links (when a board exists for the session).

What's missing on mobile:

- No way to **create** a new board. The screens only consume existing data.
- No way to **edit** the diagram (move players, draw arrows, edit text,
  switch pitch format/orientation).
- No multi-frame timeline editor.
- No AI chat for boards.
- No "fork session/drill" flow on mobile.
- No `canEdit` UX; the screens don't read or display the flag.
- No `tacticalBoardV1` feature gate; the boards API is called
  unconditionally.

---

## 2. What the web app does

`apps/web/src/app/board/[id]/page.tsx` mounts
`TacticalBoardEditor.tsx` (≈2,750 lines). Surface:

- **Pitch chrome** — pitches are drawn at real-world scale via
  `lib/pitch-formats.ts`. Three formats: `7V7` (U8–U10), `9V9` (U11–U12),
  `11V11` (U13+). Pitch layout is rendered by
  `components/boards/ScaledPitchMarkings.tsx` (lines, penalty box, center
  circle, goal, build-out lines for 7v7, etc.).
- **Toolbar** — `BoardToolbar.tsx` lists ~17 tools across grouped menus:
  select (V), add-player (P), ball (B), 5 line tools
  (free/draw/pass/run/curve/curve-rev), 3 shape tools (rect/circle/spotlight),
  label, eraser, and 4 element tools (mini-goal/cone/mannequin/pole). Two
  rendering variants: horizontal bar and vertical rail. The rail also lets
  the user pick which team to add (`ATT`/`DEF`/`NEUTRAL`).
- **Diagram editing** — select, drag-to-move players, drag endpoints to
  resize/curve arrows, eraser, undo, etc. `lib/board-lines.ts` contains the
  geometry (straight/curve/freehand), polyline helpers, and arrow-endpoint
  resolution. `lib/board-player-spacing.ts` handles overlap unstack.
- **Sequence timeline** — `lib/board-sequence.ts` and
  `components/boards/BoardSequenceBar.tsx`. Frames are stored as
  `DiagramFrameLayers` inside `diagram.sequence.frames[]` (up to 8). The
  bar lets the coach add/duplicate/delete frames, scrub through the
  sequence, and play frames back at configurable `durationMs` (default
  4000ms) with `BOARD_SEQUENCE_TWEEN_MS=600` interpolation between frames.
- **AI chat** — `components/boards/BoardAiChat.tsx` sends messages to
  `POST /boards/:id/ai-chat`. Replies can carry an updated `diagram` (and
  an `applied: true` flag) so the coach can accept the change with a
  single tap. Image upload is supported (PDF + image mime types). For
  "build this into a session" type questions, the reply includes a
  `sessionBridge` with vault recommendations and a `generatorUrl` linking
  back to the session builder.
- **Principles panel** — `BoardPrinciplesPanel.tsx` shows the club / game
  model principles that anchor the AI's voice.
- **My Boards panel** — `MyBoardsPanel.tsx` is the listing page mounted
  at `/boards`. It supports search by title, sharing mode filter, and
  pagination via cursor.

The mobile app already has `react-native-svg` (used by `BoardPreview`) and
`react-native-gesture-handler` / `react-native-reanimated` are present in
`apps/mobile/package.json`, so the native primitives for drawing are
available.

---

## 3. What the API exposes

`apps/api/src/routes-boards.ts` — all routes gated by
`isTacticalBoardV1Enabled()` (env `TACTICAL_BOARD_V1 != "0"`):

| Method | Path                       | Body                                  | Response                              |
|--------|----------------------------|---------------------------------------|---------------------------------------|
| GET    | `/boards`                  | `?limit`, `?cursor`                   | `{ boards, nextCursor }`              |
| POST   | `/boards`                  | `{ mode, shareMode, ageGroup, ... }`  | `{ board }` (modes: `BLANK`, `FORK_DRILL`, `FORK_SESSION`) |
| GET    | `/boards/:id`              | —                                     | `{ board }` (incl. `canEdit`)         |
| PATCH  | `/boards/:id`              | `{ title?, shareMode?, favorited?, …}`| `{ board }`                           |
| DELETE | `/boards/:id`              | —                                     | `{ ok }`                              |
| POST   | `/boards/:id/ai-chat`      | `{ message, image?, history?, diagram? }` | `{ reply, applied, diagram, coachLevel, playerLevel, sessionBridge? }` |
| POST   | `/boards/:id/phase-place`  | `{ phase, zone, channel, … }`         | `{ diagram }` — pre-place formation for setup phase |

The diagram itself is `WebDiagramV1` (see
`apps/api/src/services/board-diagram-schema.ts`):

```
{ pitch, players[], goals[], coach?, balls[], cones[], elements[],
  arrows[], areas[], labels[], sequence? }
```

- `players[]` — `{ id, number?, team: 'ATT'|'DEF'|'NEUTRAL', role?, x, y, … }`,
  capped at 30. `x`/`y` are 0–100 percentages of the pitch.
- `arrows[]` — `{ from, to, type, style, weight, arrowhead?, path?, control? }`,
  capped at 40, with `type` ∈ {pass, run, press, cover, transition}.
- `sequence.frames[]` — each frame is a flat copy of the same diagram, so a
  frame is also a `WebDiagramV1` (the mobile viewer uses this directly).
- Size cap: 192 KiB total per board; the API rejects larger diagrams.

The mobile service has zero types for `WebDiagramV1`. The detail screen and
`BoardPreview` read `diagram` as `any`. There's no shared type in
`packages/shared` yet.

---

## 4. Current gaps (mobile vs. web)

| Surface                              | Web | Mobile |
|--------------------------------------|-----|--------|
| List + filter / search / share mode  | ✓   | partial (no search, no share-mode filter, no pagination in UI) |
| Diagram read                         | ✓   | ✓ (same SVG renderer, fewer layers) |
| Diagram edit (move / draw / erase)   | ✓   | ✗ |
| Pitch format / orientation / zoom    | ✓   | ✗ |
| Multi-frame sequence timeline        | ✓   | ✗ (only horizontal pager, no editing) |
| AI chat (image + text → diagram)      | ✓   | ✗ |
| Principles panel                     | ✓   | ✗ |
| Create board (blank / fork drill / fork session) | ✓ | ✗ |
| Share mode toggle (private / club)   | ✓   | ✗ |
| Delete board                         | ✓   | ✗ |
| Favorite toggle                      | ✓   | ✓ (already wired) |
| Open board in sideline               | ✗   | ✗ |
| Team picker (when 2+ teams)          | ✗   | ✗ |

---

## 5. Where boards show up in the rest of the app

These are the entry points to consider when planning:

- **Home → Quick Actions** → "Boards" tile (`QuickActionGrid.tsx`).
- **Settings → Tools** → "Boards" row (`app/settings.tsx`).
- **Vault session detail** → "Tactical board" card (when a board exists
  for the session).
- **Coach Center team detail** → could surface "Boards for this team" once
  the API supports `?teamId=…` filtering (currently doesn't).
- **Vault drill detail** → same idea (boards forked from a drill).
- **Player plans / Game day pack** → share PDF can embed board images, but
  no in-app deep link today.

---

## 6. Constraints to design around

- **Coordinate system**: every position is 0–100 (percentage of pitch). The
  mobile renderer needs to translate percentage → screen pixels at render
  time. This makes zoom/pan easy: pitch dimensions are
  `(canvasWidth × ratio)` where `ratio` comes from
  `PITCH_SPECS[format].lengthYards / widthYards`.
- **Pan/zoom UX**: web uses pointer events on a 900×630 canvas. On mobile
  we need a `PanGestureHandler` + `PinchGestureHandler` over an SVG. The
  API (`patchBoard` with `{ diagram }`) lets the client send the full
  diagram on save — we don't need delta sync.
- **Save model**: web saves on every edit (debounced). For mobile we
  probably want explicit Save + an autosave-on-blur / Save & Exit
  affordance to avoid blowing through the 192 KiB cap or losing work on
  background.
- **Feature flag**: the server already gates the entire board surface on
  `TACTICAL_BOARD_V1`. The mobile should mirror that on the client to
  avoid showing empty states / dead buttons. Currently the mobile doesn't
  read `user.features.tacticalBoardV1` at all.
- **Pitch format**: `formatFromAgeGroup` exists in
  `apps/api/src/services/web-diagram-v1.ts`. Mobile should use the same
  helper so the rendered pitch matches the one used at save time.
- **react-native-svg** is already in the bundle and used. No new native
  module required for v1.
- **No PDF / image upload on mobile** is acceptable for v1 — AI chat can
  start as text-only and ship with image upload in a follow-up.