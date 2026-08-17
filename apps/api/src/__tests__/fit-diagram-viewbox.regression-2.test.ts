import { diagramFittedViewBox, fitDiagramSvgViewBox } from "../services/fit-diagram-viewbox";

// Regression: ISSUE-002 — D-PVG7 leftover canvas painted past the pitch
// Found by /qa on 2026-08-14
// Report: .gstack/qa-reports/qa-report-localhost-2026-08-14.md

const PITCH =
  '<rect x="117.92" y="74.38" width="564.16" height="313.24" fill="#1c5134"/>';

test("pitch-aware crop hugs the green field instead of a fixed 800-wide canvas", () => {
  const svg = `<svg viewBox="0 0 800 595" xmlns="http://www.w3.org/2000/svg">${PITCH}</svg>`;
  expect(diagramFittedViewBox(svg)).toBe("105.92 34.38 588.16 493.24");
  const fitted = fitDiagramSvgViewBox(svg);
  expect(fitted).toContain('viewBox="0 0 588.16 493.24"');
  expect(fitted).toContain("translate(-105.92, -34.38)");
});

test("fitted viewBox origin is 0,0 so the pitch cannot sit in a right-shifted card", () => {
  const svg = `<svg viewBox="0 0 800 595" xmlns="http://www.w3.org/2000/svg">${PITCH}</svg>`;
  const fitted = fitDiagramSvgViewBox(svg);
  expect(fitted).toMatch(/viewBox="0 0 /);
  expect(fitted).not.toMatch(/viewBox="105\./);
  expect(fitted).toContain('id="diagram-origin-fit"');
});

test("already-cropped offset viewBox is rebased to the origin", () => {
  const svg = [
    '<svg overflow="hidden" viewBox="105.92 34.38 588.16 493.24" xmlns="http://www.w3.org/2000/svg">',
    '<rect x="105.92" y="34.38" width="588.16" height="493.24" fill="#08111f"/>',
    '<defs><clipPath id="diagram-fit-clip-1"><rect x="105.92" y="34.38" width="588.16" height="493.24"/></clipPath></defs>',
    '<g clip-path="url(#diagram-fit-clip-1)">',
    PITCH,
    "</g></svg>",
  ].join("");
  const fitted = fitDiagramSvgViewBox(svg);
  expect(fitted).toContain('viewBox="0 0 588.16 493.24"');
  expect(fitted).toContain("translate(-105.92, -34.38)");
  expect(fitted).toContain('id="diagram-origin-fit"');
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
  expect(fitted).toMatch(/translate\(50\.92,0\)/);
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

test("formula zone overlays that cover the pitch are stripped", () => {
  const svg = `<svg viewBox="0 0 800 595" xmlns="http://www.w3.org/2000/svg">${PITCH}<rect x="117.92 + (50 - 40/2)/100 * 564.16" y="74.38 + (27 - 55/2)/100 * 313.24" width="225.66" height="172.28" fill="#10f0a0" opacity="0.11"/></svg>`;
  const fitted = fitDiagramSvgViewBox(svg);
  expect(fitted).not.toContain("#10f0a0");
  expect(fitted).not.toContain("117.92 +");
});

test("full-pitch Match Area label pills above the touchline are stripped", () => {
  const svg = `<svg viewBox="0 0 800 595" xmlns="http://www.w3.org/2000/svg">${PITCH}<g>
    <rect x="400.0 - 32.7" y="59.81" width="65.4" height="17" rx="4" fill="rgba(8,17,31,0.85)"/>
    <text x="400" y="72.81" fill="#d1fae5">Match Area</text>
  </g></svg>`;
  const fitted = fitDiagramSvgViewBox(svg);
  expect(fitted).not.toContain("Match Area");
  expect(fitted).not.toContain("400.0 -");
});
