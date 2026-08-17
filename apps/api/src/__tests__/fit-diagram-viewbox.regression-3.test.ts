import { fitDiagramSvgViewBox } from "../services/fit-diagram-viewbox";

// Regression: ISSUE-003 — API hydrate + client StoredDrillSvg both call fit
// Found by /qa on 2026-08-14
// Report: .gstack/qa-reports/qa-report-localhost-2026-08-14.md

const PITCH =
  '<rect x="117.92" y="74.38" width="564.16" height="313.24" fill="#1c5134"/>';

test("fitting an already-cropped SVG does not wrap a second clipPath", () => {
  const svg = `<svg viewBox="0 0 800 595" xmlns="http://www.w3.org/2000/svg"><defs></defs>${PITCH}</svg>`;
  const once = fitDiagramSvgViewBox(svg);
  const twice = fitDiagramSvgViewBox(once);
  expect(twice).toBe(once);
  expect(once.match(/diagram-fit-clip-\d+/g)?.length).toBe(2);
});
