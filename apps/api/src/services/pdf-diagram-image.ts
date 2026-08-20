import { Resvg } from "@resvg/resvg-js";
import { diagramFittedViewBox, pitchRectFromSvg } from "./fit-diagram-viewbox";

/** Goals, zone pills, and the Coach label sit outside the green. */
const PDF_PAD_X = 64;
const PDF_PAD_TOP = 78;
const PDF_PAD_BOTTOM = 160;

export function pickDrillSvg(drill: { diagramSvg?: unknown; json?: unknown }): string | null {
  const nested =
    drill.json && typeof drill.json === "object"
      ? (drill.json as Record<string, unknown>)
      : null;
  for (const value of [drill.diagramSvg, nested?.diagramSvg]) {
    if (typeof value === "string" && /<svg[\s>]/i.test(value)) return value;
  }
  return null;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function applyViewBox(svg: string, viewBox: string): string {
  return svg.replace(/<svg\b[^>]*>/i, (openTag) => {
    let tag = /viewBox\s*=/.test(openTag)
      ? openTag.replace(/viewBox\s*=\s*["'][^"']*["']/i, `viewBox="${viewBox}"`)
      : openTag.replace(/<svg\b/i, `<svg viewBox="${viewBox}"`);
    if (!/\boverflow\s*=/i.test(tag)) {
      tag = tag.replace(/<svg\b/i, `<svg overflow="hidden"`);
    } else {
      tag = tag.replace(/\boverflow\s*=\s*["'][^"']*["']/i, `overflow="hidden"`);
    }
    return tag;
  });
}

/**
 * Browser fit rebases the crop to 0,0 and translates the drawing. Resvg
 * treats that as a second camera, so the pitch drifts. Neutralize the
 * translate/clip (do not delete wrappers — that drops legend/goal closes)
 * and crop with viewBox in the original 800×595 coordinates.
 */
export function stripBrowserFit(svg: string): string {
  if (!svg.includes("diagram-origin-fit") && !/diagram-fit-clip-\d+/.test(svg)) {
    return svg;
  }
  let next = svg.replace(/<g clip-path="url\(#diagram-fit-clip-\d+\)">/g, "<g>");
  next = next.replace(
    /<g id="diagram-origin-fit" transform="translate\([^)]+\)">/g,
    `<g id="diagram-origin-fit">`
  );
  next = next.replace(/<clipPath id="diagram-fit-clip-\d+"><rect[^>]*\/><\/clipPath>/g, "");
  next = applyViewBox(next, "0 0 800 595");
  next = next.replace(
    /<rect x="0" y="0" width="[\d.]+" height="[\d.]+" fill="#08111f"/,
    `<rect x="0" y="0" width="800" height="595" fill="#08111f"`
  );
  return next;
}

function pdfViewBox(svg: string): string | null {
  const pitch = pitchRectFromSvg(svg);
  if (pitch) {
    const minX = Math.max(0, round(pitch.x - PDF_PAD_X));
    const minY = Math.max(0, round(pitch.y - PDF_PAD_TOP));
    const width = round(pitch.w + PDF_PAD_X * 2);
    const height = round(pitch.h + PDF_PAD_TOP + PDF_PAD_BOTTOM);
    return `${minX} ${minY} ${width} ${height}`;
  }
  return diagramFittedViewBox(svg);
}

/** Crop in original SVG space. Do not origin-translate — Resvg already honors viewBox. */
export function prepareSvgForPdf(svg: string): string {
  const raw = stripBrowserFit(svg);
  const viewBox = pdfViewBox(raw);
  if (!viewBox) return raw;
  const parts = viewBox.split(" ").map(Number);
  const width = parts[2];
  const height = parts[3];
  return raw.replace(/<svg\b[^>]*>/i, () =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}" overflow="hidden">`
  );
}

export function rasterizeDiagramSvg(svg: string, widthPx = 1200): Buffer | null {
  try {
    const prepared = prepareSvgForPdf(svg);
    const resvg = new Resvg(prepared, {
      fitTo: { mode: "width", value: widthPx },
      background: "#08111f",
    });
    return Buffer.from(resvg.render().asPng());
  } catch (error) {
    console.error("[PDF] Failed to rasterize diagram SVG:", error);
    return null;
  }
}
