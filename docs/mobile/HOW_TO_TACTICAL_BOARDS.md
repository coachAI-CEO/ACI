# How to: tactical boards on mobile

Task recipes for the native board editor (Phases A→G.5). For shapes and
inventory see [`../TACTICAL_BOARD_TYPES.md`](../TACTICAL_BOARD_TYPES.md) and
[`../TACTICAL_BOARD_MOBILE_INVENTORY.md`](../TACTICAL_BOARD_MOBILE_INVENTORY.md).
First-time walkthrough: [`TUTORIAL_FIRST_BOARD.md`](TUTORIAL_FIRST_BOARD.md).

Requires `user.features.tacticalBoardV1`. If disabled, Boards shows
"coming soon" and the Home tile is muted.

---

## Open or create a board

1. Home → **Boards**, or empty-state CTA with `?create=1`.
2. **Create** → Blank / From a session / From a drill (share mode when prompted).
3. Owned boards with `canEdit` open **`/boards/[id]/edit`** directly.
4. Read-only / club boards you cannot edit open **`/boards/[id]`** (detail).

Blank create needs a working API. Non-club accounts get a `COACHAI` game-model
fallback; club-only share may soft-downgrade to private if the API rejects CLUB.

---

## Draw on the pitch

Editor chrome (matches interactive mock):

1. **Header:** Undo / Redo · title · Save · ⋯
2. **Format + Zoom** only (no extra chrome on the pitch)
3. **Canvas** with tool hint + ATT / DEF / NEU overlays when relevant
4. **Frame bar** under the pitch
5. **Five-tool tray:** Move · Player · Arrow · Ball · Erase

| Goal | Do this |
|---|---|
| Move a player | Move tool → drag |
| Move an arrow | Move tool → drag the line (or gold ends) |
| Add a player | Player tool → tap pitch → set number/role/team in popover |
| Draw a pass / run / press | Arrow tool → pick **Pass · Run · Press** → drag from → to |
| Draw web line types | Arrow tool → **Free / Line / Arrow / Dash / Curve / Curve↺** → drag |
| Edit an arrow | Move tool → tap arrow → change coaching type / line type / flip / delete |
| Place a ball | Ball tool → tap |
| Place a label | Label tool → tap → edit text |
| Edit a label | Move tool → long-press label |
| Place a shape | Shape tool → Spot / Circle / Rect → tap |
| Place kit | Kit tool → Cone / Goal / Man / Pole → tap |
| Rotate mini-goal | Move tool → long-press mini-goal |
| Remove | Erase tool → tap target |
| Rename a frame | Long-press frame chip → rename |
| Flip to landscape | Rotate the phone — pitch auto-switches to horizontal |
| Zoom Full / Half / Third | Segmented control above the pitch — crops from the away goal; saved as `pitch.variant` |
| Change 7v7 / 9v9 / 11v11 | Format control → **formation popup** (pick ATT/DEF) → Apply |
| Setup formations / format | ⋯ → **Setup · formations** → format reset, ATT/DEF shapes, show/hide teams |
| Phase · third · channel | Same Setup sheet → pick Phase × Third × Channel → **Apply phase placement** |
| Lanes / thirds overlay | Setup → Lanes / Thirds toggles |
| Persist | **Save** (unsaved edits stay local until then) |
| Rename board | ⋯ → **Rename board** |

---

## Multi-frame sequence

1. Use the **frame bar** under the pitch: add / duplicate / delete / rename (long-press chip → rename on iOS and Android).
2. Edit each frame independently (full layers snapshot per frame).
3. Playback uses shared `interpolateLayers` between frames.
4. Detail screen keeps a scrub bar for read-only playback.

---

## AI chat (text + photo)

1. ⋯ → **AI** (or AI entry on detail).
2. Type a request, tap a suggestion chip, and/or **Photo** to attach a pitch image.
3. Wait for an `applied` preview when offered; **Apply** commits into the diagram.
4. If the reply includes session ideas, **Open Session Builder** opens the web generator.

---

## Share, privacy, delete, web

| Goal | Where |
|---|---|
| Private ↔ Club | Editor ⋯ menu |
| Share / copy link patterns | List card overflow or detail actions |
| Delete | ⋯ → Delete (confirm) |
| Dense desktop tools | ⋯ → **Edit on web** |

---

## Offline

Own boards are cached (list + detail). When the API is unreachable you can
still **view** cached boards. Creating/saving needs network.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Cannot reach API" / looks down | Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env`, restart Metro `--clear` |
| Boards tile muted / coming soon | Account lacks `tacticalBoardV1` |
| Blank create fails `GAME_MODEL_REQUIRED` | Staging API must include blank-board fallback (`allowFallbackDefault`); deploy/main fix if old |
| Opens detail instead of editor | Board is not `canEdit` for this user |

---

## Related

- Plan: [`../TACTICAL_BOARD_MOBILE_PLAN.md`](../TACTICAL_BOARD_MOBILE_PLAN.md)
- Tutorial: [`TUTORIAL_FIRST_BOARD.md`](TUTORIAL_FIRST_BOARD.md)
- Release / env: [`../release-process.md`](../release-process.md)
- Hub: [`../../DOCUMENTATION.md`](../../DOCUMENTATION.md)
