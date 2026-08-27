# Tactical Board — Mobile Inventory

What's on the mobile app today, what the web app does, and what the API
exposes. Last updated **2026-08-25** after Phases A → G.5 shipped on
`codex/mobile-app`.

For the phased plan and remaining work, see
`docs/TACTICAL_BOARD_MOBILE_PLAN.md`.

---

## 1. What exists today on mobile

### Screens (`apps/mobile/app/boards/`)

| Route | File | Role |
|---|---|---|
| `/boards` | `index.tsx` | List + search + share filter + create sheet. Offline fallback banner. Feature-gated by `tacticalBoardV1`. Zero-board CTA opens create via `?create=1`. |
| `/boards/[id]` | `[id].tsx` | Read-only detail (format / orientation / zoom, sequence bar, AI sheet, share). Used for **non-editable** boards. |
| `/boards/[id]/edit` | `[id]/edit.tsx` | **Primary editor** for `canEdit` boards. Layout matches `TACTICAL_BOARD_INTERACTIVE_MOCK`. |

**Open-to-editor rule**: `BoardCard` and the post-create flow push
`/boards/[id]/edit` when `canEdit`. Read-only boards stay on detail.

### Components (`apps/mobile/components/boards/`)

| Component | Role |
|---|---|
| `BoardPreview` | Read-only SVG pitch + layers (`React.memo`) |
| `BoardCanvas` | Interactive editor canvas (gestures, tools) (`React.memo`) |
| `BoardToolPalette` | Five-tool tray: Move / Player / Arrow / Ball / Erase + `toolHint()` |
| `BoardSequenceBar` | Still used on the **detail** screen for playback scrubbing |
| `BoardAiSheet` | Text AI chat bottom sheet |
| `PlayerPopover` | Number / role / team / delete |
| `BoardCard` | List row; opens editor when editable |
| `CreateBoardSheet` | Blank / fork session / fork drill |

### Editor chrome (G.5 — matches interactive mock)

1. Nav: Undo / Redo · "Edit board" · Save · ⋯
2. Meta: Format (7v7/9v9/11v11) + Zoom (Full/Half/Third)
3. Canvas fills remaining height; overlays:
   - tool-hint badge (top-left)
   - ATT / DEF / NEU pill (top-right)
4. Frame bar under pitch: chips + Frame / Duplicate / Delete / Play
5. Bottom tool tray (five tools)

Overflow (⋯): AI coach, Share Private↔Club, flip orientation, Edit on
web, Delete.

### Services + offline

`apps/mobile/services/boards.service.ts`:

- `listBoards` / `getBoard` / `createBoard` / `patchBoard` / `deleteBoard`
- `setBoardFavorited` / `sendBoardAiChat`
- `extractBoardFrames`

`apps/mobile/services/offline-cache.service.ts` +
`hooks/useOfflineBoardsSync.ts`:

- Per-user list + detail cache (mirrors Vault offline pattern)
- Seeded on login; refreshed when connectivity returns

### Feature gate

`UserFeatures.tacticalBoardV1` (shared type). When off:

- Quick Actions "Boards" tile muted/disabled
- `/boards` shows "Boards are coming soon" + Open web
- List query is not enabled

### Entry points

- Home Quick Actions → `/boards` (or `/boards?create=1` when zero boards)
- Settings → Tools → Boards
- Deep link / create success → editor when `canEdit`

---

## 2. Shared package (`@aci/shared`)

Canonical diagram + board libs (Phases A / A.5):

- `types/tactical-board.ts` — `WebDiagramV1` and friends
- `board/pitch-formats.ts`
- `board/elements.ts`
- `board/lines.ts`
- `board/player-spacing.ts`
- `board/sequence.ts`

Mobile, web, and API all import from `@aci/shared`. See
`docs/TACTICAL_BOARD_TYPES.md`.

---

## 3. API surface (relevant routes)

| Method | Path | Notes |
|---|---|---|
| `GET` | `/boards` | Cursor pagination |
| `GET` | `/boards/:id` | Detail + diagram |
| `POST` | `/boards` | `BLANK` / `FORK_SESSION` / `FORK_DRILL` |
| `PATCH` | `/boards/:id` | title, shareMode, favorited, diagram, ageGroup |
| `DELETE` | `/boards/:id` | Owner only |
| `POST` | `/boards/:id/ai-chat` | Text AI; returns `{ reply, applied, diagram, … }` |

Blank create (`createBlankBoard`) allows a default game model
(`COACHAI`) when the coach has no club stamp, and soft-downgrades
`shareMode: CLUB` → `PRIVATE` for non-club coaches. Shipped on `main`
as PR #9 (`b42fddf`); also present on `codex/mobile-app` as `d67929d`.

All `/boards/*` routes are gated by `tacticalBoardV1` on the server.

---

## 4. What the web still owns

- Full desktop drawing surface (endpoint reshape, area resize, more tools)
- PDF / image export of the board
- Principles panel beside AI chat
- Multi-board AI chat
- Rich drill picker for fork-from-drill

Mobile covers create / edit / sequence / AI (text) / share / delete /
offline read for owned boards.

---

## 5. Known gaps / next

See Phase H + "Also parked" in `docs/TACTICAL_BOARD_MOBILE_PLAN.md`:

- Vault → board editor deep link
- Coach Center team → boards section
- F v2 AI polish (welcome, optimistic bubbles, read-only composer)
- Image/PDF AI attachments
- Arrow/area advanced edit handles

---

## 6. Local run notes

- Active worktree for mobile: prefer the checkout on `codex/mobile-app`
  (historically `aci-mobile-dev` when a second worktree is in use).
- Require `apps/mobile/.env`:

  ```
  EXPO_PUBLIC_API_URL=https://tacticaledge-api.onrender.com
  EXPO_PUBLIC_WEB_URL=https://tacticaledge.app
  ```

  Without it, the client falls back to `http://localhost:4000` and looks
  like the API is down.
