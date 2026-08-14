import { omitDiagramSvgFromDrill, storedDiagramNeedsRedraw } from "../services/drill-diagram-svg";
import { mergeStoredSvgsOntoDrills } from "../services/session-diagram-hydrate";
import {
  pickDrillDiagramSvg,
  pickDrillSvgId,
  sessionDrillsHaveStoredSvgs,
} from "../../../web/src/lib/diagram-svg";

// Regression: ISSUE-001 — vault preview asked Gemini to redraw a saved diagram
// Found by /qa on 2026-08-14
// Report: .gstack/qa-reports/qa-report-localhost-2026-08-14.md

const SAVED_SVG = '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';

test("stored SVG is returned on reopen instead of redrawing", () => {
  expect(storedDiagramNeedsRedraw(false, SAVED_SVG)).toBe(false);
  expect(storedDiagramNeedsRedraw(false, null)).toBe(true);
  expect(storedDiagramNeedsRedraw(true, SAVED_SVG)).toBe(true);
});

test("session json does not keep a second copy of the SVG blob", () => {
  const stripped = omitDiagramSvgFromDrill({
    refCode: "D-QABC",
    title: "Back Line Passing and Receiving Circuit",
    diagramSvg: SAVED_SVG,
  });
  expect(stripped).toEqual({
    refCode: "D-QABC",
    title: "Back Line Passing and Receiving Circuit",
  });
  expect("diagramSvg" in stripped).toBe(false);
});

test("vault preview hydrates drill 2 from the Drill column when json omitted the SVG", () => {
  const drills = [
    { refCode: "D-UMMG", title: "Warm-up", diagramSvg: SAVED_SVG },
    { refCode: "D-QABC", title: "Back Line Passing and Receiving Circuit" },
  ];
  const merged = mergeStoredSvgsOntoDrills(drills, [
    { id: "uuid-1", refCode: "D-UMMG", diagramSvg: SAVED_SVG },
    { id: "uuid-2", refCode: "D-QABC", diagramSvg: SAVED_SVG },
  ]);
  expect(pickDrillDiagramSvg(merged[1])).toBe(SAVED_SVG);
});

test("vault composite ids are skipped so lookup uses D-XXXX", () => {
  expect(
    pickDrillSvgId({
      id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-1",
      refCode: "D-QABC",
    })
  ).toBe("D-QABC");
});

test("session preview treats stored SVGs as already drawn", () => {
  expect(
    sessionDrillsHaveStoredSvgs({
      json: {
        drills: [
          { drillType: "WARMUP", diagramSvg: SAVED_SVG },
          { drillType: "TECHNICAL", diagramSvg: SAVED_SVG },
          { drillType: "COOLDOWN" },
        ],
      },
    })
  ).toBe(true);
});
