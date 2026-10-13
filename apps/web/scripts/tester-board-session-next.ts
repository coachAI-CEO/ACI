/**
 * Headless checks for the board session-next pack (notes, play ease/rails, editor ops).
 *
 *   cd apps/web
 *   pnpm tester:board-session
 *
 * Browser QA (http://localhost:3000/boards — web :3000, API :4001):
 *   1. Open a board
 *   2. Note under the pitch → Save → reload (note still there)
 *   3. Duration chips 0.8s / 1.6s → duplicate a slide (+) → Play
 *   4. Draw an arrow, duplicate the slide, move the arrow, Play (it should tween, not jump)
 *   5. Add a ball, erase a line, Save → reload (ball + remaining arrows still there)
 *   6. Export → PNG this slide, then GIF the session
 *   7. Narrow the window: tools in the bottom dock, Play in the dock
 *   8. Marquee-drag empty grass → Group / Flip / Dup / Stamp
 *   9. ⌘Z / ⇧⌘Z, ⌘D, arrow keys, snap "10" toggle, R on a mini-goal
 */
import { ensureDiagramObjectIds } from "../src/lib/board-ids.ts";
import {
  BOARD_SEQUENCE_MAX_FRAMES,
  duplicateActiveFrame,
  interpolateLayers,
  updateActiveFrameMeta,
} from "../src/lib/board-sequence.ts";
import {
  assignPlayerGroup,
  duplicatePlayers,
  flipPlayersHorizontal,
  nudgePlayers,
  snapCoord,
  stampFromPlayers,
} from "../src/lib/board-editor-ops.ts";
import type { DiagramV1 } from "../src/types/diagram.ts";

let failed = 0;

function assert(cond: unknown, msg: string) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
    return;
  }
  failed += 1;
  console.error(`  ✗ ${msg}`);
}

function baseDiagram(): DiagramV1 {
  return {
    pitch: { variant: "FULL", orientation: "HORIZONTAL", format: "7V7" },
    players: [
      { id: "p-a", team: "ATT", number: 9, x: 40, y: 40 },
      { id: "p-b", team: "ATT", number: 10, x: 50, y: 40 },
    ],
    arrows: [
      {
        id: "a-run",
        from: { playerId: "p-a" },
        to: { x: 70, y: 40 },
        type: "run",
        style: "dashed",
        weight: "normal",
      },
    ],
    areas: [],
    labels: [],
    balls: [{ id: "b-0", x: 45, y: 45 }],
  };
}

console.log("\n[snap / nudge / dup / flip / group]");
assert(snapCoord(5, true) === 6, "snap 5 → 6 (2% grid)");
assert(snapCoord(5, false) === 5, "snap off leaves 5");

const duped = duplicatePlayers(baseDiagram(), ["p-a", "p-b"]);
assert(duped.players.length === 4, "duplicate two shirts → 4 players");
assert(
  duped.players.slice(2).every((p) => p.x === 43 || p.x === 53),
  "duplicates offset by +3 on x"
);

const flipped = flipPlayersHorizontal(baseDiagram(), ["p-a", "p-b"]);
assert(flipped.players[0].x === 50 && flipped.players[1].x === 40, "flip about selection centroid");

const nudged = nudgePlayers(baseDiagram(), ["p-a"], 1, 0, true);
assert(nudged.players[0].x === 42, "nudge +1 with snap lands on 42");

const grouped = assignPlayerGroup(baseDiagram(), ["p-a", "p-b"], "g-1");
assert(
  grouped.players.every((p) => p.group === "g-1"),
  "group id lands on both shirts"
);

const stamp = stampFromPlayers(baseDiagram().players, "Front two");
assert(stamp !== null && stamp.players.length === 2, "stamp from 2+ players");

console.log("\n[sequence notes / 12 frames / play rails]");
assert(BOARD_SEQUENCE_MAX_FRAMES === 12, "client frame cap is 12");

let seq = baseDiagram();
seq = updateActiveFrameMeta(seq, { note: "Switch the 9", durationMs: 2400 });
assert(seq.sequence?.frames[0].note === "Switch the 9", "note writes onto the active frame");
assert(seq.sequence?.frames[0].durationMs === 2400, "durationMs writes onto the active frame");

for (let i = 0; i < 11; i++) seq = duplicateActiveFrame(seq);
assert(seq.sequence?.frames.length === 12, "can duplicate up to 12 frames");
const atCap = duplicateActiveFrame(seq);
assert(atCap.sequence?.frames.length === 12, "13th duplicate is a no-op");

const from = {
  players: [
    { id: "p-a", team: "ATT" as const, x: 0, y: 0 },
    { id: "p-b", team: "ATT" as const, x: 10, y: 10 },
  ],
  arrows: [
    {
      id: "linked",
      from: { playerId: "p-a" },
      to: { x: 80, y: 50 },
      type: "pass" as const,
      style: "solid" as const,
      weight: "normal" as const,
    },
    {
      id: "free",
      from: { x: 10, y: 10 },
      to: { x: 20, y: 20 },
      type: "transition" as const,
      style: "solid" as const,
      weight: "normal" as const,
    },
  ],
  areas: [],
  labels: [],
  balls: [{ id: "b-0", x: 0, y: 0 }],
};
const to = {
  players: [
    { id: "p-a", team: "ATT" as const, x: 100, y: 0 },
    { id: "p-b", team: "ATT" as const, x: 10, y: 10 },
  ],
  arrows: [
    {
      id: "linked",
      from: { playerId: "p-a" },
      to: { x: 90, y: 50 },
      type: "pass" as const,
      style: "solid" as const,
      weight: "normal" as const,
    },
    {
      id: "free",
      from: { x: 30, y: 30 },
      to: { x: 40, y: 40 },
      type: "transition" as const,
      style: "solid" as const,
      weight: "normal" as const,
    },
  ],
  areas: [],
  labels: [],
  balls: [{ id: "b-0", x: 100, y: 0 }],
};

const mid = interpolateLayers(from, to, 0.5);
const pa = mid.players.find((p) => p.id === "p-a")!;
assert(pa.x > 40 && pa.x < 60, `ease-in-out at t=0.5 is near center (x=${pa.x.toFixed(1)})`);
assert(mid.arrows[0].from.playerId === "p-a", "linked arrow keeps playerId so it rides the shirt");
const free = mid.arrows[1];
assert(
  typeof free.from.x === "number" && free.from.x > 10 && free.from.x < 30,
  "free arrow endpoints lerp"
);

console.log("\n[stable object ids]");
const legacy = ensureDiagramObjectIds({
  pitch: { variant: "FULL", orientation: "HORIZONTAL", format: "7V7" },
  players: [{ id: "p-a", team: "ATT", x: 40, y: 40 }],
  arrows: [
    {
      from: { x: 10, y: 10 },
      to: { x: 20, y: 20 },
      type: "pass",
      style: "solid",
      weight: "normal",
    },
  ],
  areas: [{ x: 30, y: 30, width: 10, height: 10 }],
  labels: [{ text: "Go", x: 5, y: 5 }],
  balls: [{ x: 50, y: 50 }],
  sequence: {
    activeFrameId: "f1",
    frames: [
      {
        id: "f1",
        players: [{ id: "p-a", team: "ATT", x: 40, y: 40 }],
        arrows: [
          {
            from: { x: 10, y: 10 },
            to: { x: 20, y: 20 },
            type: "pass",
            style: "solid",
            weight: "normal",
          },
        ],
        areas: [{ x: 30, y: 30, width: 10, height: 10 }],
        labels: [{ text: "Go", x: 5, y: 5 }],
        balls: [{ x: 50, y: 50 }],
      },
      {
        id: "f2",
        players: [{ id: "p-a", team: "ATT", x: 70, y: 40 }],
        arrows: [
          {
            from: { x: 15, y: 15 },
            to: { x: 25, y: 25 },
            type: "pass",
            style: "solid",
            weight: "normal",
          },
        ],
        areas: [{ x: 40, y: 30, width: 10, height: 10 }],
        labels: [{ text: "Go", x: 8, y: 5 }],
        balls: [{ x: 80, y: 50 }],
      },
    ],
  },
} as unknown as DiagramV1);
const f1 = legacy.sequence!.frames[0];
const f2 = legacy.sequence!.frames[1];
assert(Boolean(legacy.arrows[0].id), "root arrow gets an id");
assert(f1.arrows[0].id === f2.arrows[0].id, "legacy arrows in the same slot share an id across frames");
assert(f1.balls![0].id === f2.balls![0].id, "legacy balls in the same slot share an id across frames");
assert(f1.labels[0].id === f2.labels[0].id, "legacy labels in the same slot share an id across frames");
const tween = interpolateLayers(f1, f2, 0.5);
assert(tween.arrows[0].id === f1.arrows[0].id, "play matches arrows by id");
assert(tween.balls![0].x > 50 && tween.balls![0].x < 80, "play lerps the same ball by id");

const swapped = {
  ...f2,
  arrows: [
    {
      id: "a-other",
      from: { x: 1, y: 1 },
      to: { x: 2, y: 2 },
      type: "run" as const,
      style: "dashed" as const,
      weight: "normal" as const,
    },
    f2.arrows[0],
  ],
};
const tweenSwapped = interpolateLayers(f1, swapped, 0.5);
assert(
  tweenSwapped.arrows[0].id === f1.arrows[0].id,
  "play matches by id even if the array order changed"
);
assert(
  typeof tweenSwapped.arrows[0].from.x === "number" &&
    tweenSwapped.arrows[0].from.x > 10 &&
    tweenSwapped.arrows[0].from.x < 15,
  "the id-matched arrow lerps its own endpoints, not the other slot"
);

console.log(
  failed
    ? `\n${failed} check(s) failed`
    : "\nAll session-next logic checks passed.\n\nBrowser: http://localhost:3000/boards"
);
if (failed) process.exit(1);
