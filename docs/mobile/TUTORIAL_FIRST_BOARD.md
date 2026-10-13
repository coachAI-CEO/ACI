# Tutorial: your first tactical board (mobile)

Goal: in one sitting, create a blank board, place players and an arrow, save,
and confirm it shows in the list. About 10 minutes on a simulator or device.

Prerequisites: Expo running against an API with boards enabled
(`tacticalBoardV1`), and `apps/mobile/.env` pointing at that API
(see [`README.md`](README.md)).

---

## Step 1: Reach Boards

1. Sign in.
2. On Home, tap **Boards** (or the empty-state create CTA).
3. If you see "Boards are coming soon", stop — the feature flag is off for
   this account.

You should see the boards list (possibly empty).

---

## Step 2: Create a blank board

1. Tap create / **+**.
2. Choose **Blank**.
3. Pick share mode if asked (Private is fine for a first try).
4. Wait for navigation into **`/boards/[id]/edit`**.

You should see the pitch, tool tray, and Save in the header.

---

## Step 3: Place two players and a pass

1. Tap **Player**, then tap two spots on the pitch.
2. For each, set a number in the popover (e.g. 6 and 10).
3. Tap **Arrow**, drag from the first player toward the second.
4. Tap **Save**. Wait for success (no error toast).

---

## Step 4: Confirm in the list

1. Go back to **Boards**.
2. Your board should appear; tap it — you should land in the editor again
   (owned / editable boards skip read-only detail).

---

## Step 5 (optional): Add a second frame

1. On the frame bar, add or duplicate a frame.
2. Move a player in the new frame.
3. Play the sequence briefly, then **Save**.

---

## You did it

You can now create, edit, and save boards natively. Next recipes:
[`HOW_TO_TACTICAL_BOARDS.md`](HOW_TO_TACTICAL_BOARDS.md) (AI chat, share,
fork from session). Why types are shared:
[`../TACTICAL_BOARD_TYPES.md`](../TACTICAL_BOARD_TYPES.md).
