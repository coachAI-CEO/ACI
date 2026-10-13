import { validateAndCleanSVG } from "../services/gemini-drawer";

const validSvg = `<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
${Array.from({ length: 20 }, (_, idx) => `<rect x="${idx}" y="${idx}" width="10" height="10" fill="#0a0d10"/>`).join("\n")}
</svg>`;

test("accepts valid raw SVG", () => {
  const result = validateAndCleanSVG(validSvg);
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.svg.startsWith("<svg")).toBe(true);
});

test("cleans markdown fences", () => {
  const result = validateAndCleanSVG(`\`\`\`svg\n${validSvg}\n\`\`\``);
  expect(result.ok).toBe(true);
});

test("rejects unquoted XML attributes", () => {
  const invalidSvg = `<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
${Array.from({ length: 20 }, (_, idx) => `<rect x="${idx}" y="${idx}" width="10" height="10" fill="#0a0d10"/>`).join("\n")}
<rect x=0 y="0" width="800" height="600" fill="#000"/>
</svg>`;
  const result = validateAndCleanSVG(invalidSvg);
  expect(result).toMatchObject({ ok: false, reason: "xml_error" });
});

test("rejects unsafe SVG before storage", () => {
  const result = validateAndCleanSVG(`<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
${Array.from({ length: 20 }, (_, idx) => `<rect x="${idx}" y="${idx}" width="10" height="10" fill="#0a0d10"/>`).join("\n")}
<script>alert("x")</script>
</svg>`);
  expect(result).toMatchObject({ ok: false, reason: "unsafe_svg" });
});

test("rejects suspiciously short output", () => {
  const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  const result = validateAndCleanSVG(`<svg viewBox="0 0 800 600"></svg>`);
  expect(result).toMatchObject({ ok: false, reason: "too_short" });
  warnSpy.mockRestore();
});

test("too_short judges the model output, not the output plus injected chrome", () => {
  const body = "<rect x=\"0\" y=\"0\" width=\"10\" height=\"10\"/>".repeat(8); // ~300 chars of model output
  const result = validateAndCleanSVG(`<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">${body}</svg>`);
  expect(result).toMatchObject({ ok: false, reason: "too_short" });
});
