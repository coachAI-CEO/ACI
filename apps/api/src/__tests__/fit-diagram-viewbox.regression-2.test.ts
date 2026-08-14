import { diagramFittedViewBox, fitDiagramSvgViewBox } from "../services/fit-diagram-viewbox";

// Regression: ISSUE-002 — D-PVG7 leftover canvas painted past the pitch
// Found by /qa on 2026-08-14
// Report: .gstack/qa-reports/qa-report-localhost-2026-08-14.md

const PITCH =
  '<rect x="117.92" y="74.38" width="564.16" height="313.24" fill="#1c5134"/>';

test("pitch-aware crop hugs the green field instead of a fixed 800-wide canvas", () => {
  const svg = `<svg viewBox="0 0 800 595" xmlns="http://www.w3.org/2000/svg">${PITCH}</svg>`;
  expect(diagramFittedViewBox(svg)).toBe("113.92 34.38 572.16 493.24");
  expect(fitDiagramSvgViewBox(svg)).toContain('viewBox="113.92 34.38 572.16 493.24"');
});

test("legend chips left of the crop are shifted into view", () => {
  const svg = [
    '<svg viewBox="0 0 800 595" xmlns="http://www.w3.org/2000/svg">',
    PITCH,
    '<circle cx="63" cy="443.62" r="7" fill="#3b82f6"/>',
    '<text x="80" y="448.62">Attack (8)</text>',
    '<g id="api-goal-overlay"></g>',
    "</svg>",
  ].join("");
  const fitted = fitDiagramSvgViewBox(svg);
  expect(fitted).toContain('id="diagram-legend-fit"');
  expect(fitted).toMatch(/translate\(58\.92,0\)/);
});

test("SVGs without a pitch rect are left alone", () => {
  const svg = '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
  expect(fitDiagramSvgViewBox(svg)).toBe(svg);
});

test("cropped canvas is clipped so leftover pitch lines cannot paint past the card", () => {
  const svg = `<svg viewBox="0 0 800 595" xmlns="http://www.w3.org/2000/svg"><defs></defs>${PITCH}<rect x="700" y="74" width="80" height="313" fill="#1c5134"/></svg>`;
  const fitted = fitDiagramSvgViewBox(svg);
  expect(fitted).toContain('overflow="hidden"');
  expect(fitted).toMatch(/id="diagram-fit-clip-\d+"/);
  expect(fitted).toMatch(/clip-path="url\(#diagram-fit-clip-\d+\)"/);
});
