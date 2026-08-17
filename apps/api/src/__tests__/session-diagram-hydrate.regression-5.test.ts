import { mergeStoredSvgsOntoDrills } from "../services/session-diagram-hydrate";

// Regression: ISSUE-004 follow-up — session page kept the old D-PVG7 drawing
// Found by /qa on 2026-08-14
// Report: .gstack/qa-reports/qa-report-localhost-2026-08-14.md

test("session hydrate prefers Drill.diagramSvg over a stale svg in session.json", () => {
  const stale = '<svg viewBox="0 0 10 10"><text>OLD</text></svg>';
  const fresh = '<svg viewBox="0 0 10 10"><text>NEW</text></svg>';
  const merged = mergeStoredSvgsOntoDrills(
    [{ refCode: "D-PVG7", diagramSvg: stale }],
    [{ id: "abc", refCode: "D-PVG7", diagramSvg: fresh }]
  );
  expect((merged[0] as { diagramSvg: string }).diagramSvg).toContain("NEW");
  expect((merged[0] as { diagramSvg: string }).diagramSvg).not.toContain("OLD");
});
