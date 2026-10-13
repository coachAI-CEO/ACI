import { renderGoalOverlay } from "../services/goal-overlay";

test("minis on a right-end corner stay on the right endline, not the top", () => {
  const svg = renderGoalOverlay([
    { id: "g1", x: 100, y: 5, width: 5, type: "mini" },
    { id: "g2", x: 100, y: 95, width: 5, type: "mini" },
  ]);
  const fieldRight = 117.92 + 564.16;
  expect(svg).toContain(`M ${fieldRight}`);
  expect(svg).not.toMatch(new RegExp(`L \\d+(\\.\\d+)? 74\\.38 `));
});
