/** Crop unused canvas chrome so the green pitch fills the card.
 * Drawings sit on an 800-wide canvas with the field at ~x=118. A hardcoded
 * crop still left ~5% dark gutter, and the right goal made that look like a
 * right-shift. Crop to the actual pitch rect instead. */

const PITCH_FILL = "#1c5134";
const SIDE_PAD = 56;
const TOP_PAD = 42;
const BOTTOM_PAD = 140;

function attr(tag: string, name: string): number | null {
  const match = tag.match(new RegExp(`\\b${name}="([\\d.]+)"`, "i"));
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export function pitchRectFromSvg(svg: string): { x: number; y: number; w: number; h: number } | null {
  const tag = svg.match(new RegExp(`<rect\\b[^>]*fill="${PITCH_FILL}"[^>]*>`, "i"))?.[0];
  if (!tag) return null;
  const x = attr(tag, "x");
  const y = attr(tag, "y");
  const w = attr(tag, "width");
  const h = attr(tag, "height");
  if (x == null || y == null || w == null || h == null || w < 10 || h < 10) return null;
  return { x, y, w, h };
}

export function diagramFittedViewBox(svg: string): string | null {
  const pitch = pitchRectFromSvg(svg);
  if (!pitch) return null;
  const minX = Math.max(0, pitch.x - SIDE_PAD);
  const minY = Math.max(0, pitch.y - TOP_PAD);
  const width = pitch.w + SIDE_PAD * 2;
  const height = pitch.h + TOP_PAD + BOTTOM_PAD;
  return `${round(minX)} ${round(minY)} ${round(width)} ${round(height)}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function shiftLegendIntoView(svg: string, fieldBottom: number, viewMinX: number): string {
  if (svg.includes('id="diagram-legend-fit"')) return svg;

  const circleRe = /<circle\b[^>]*>/gi;
  let minCx = Infinity;
  let firstIdx = -1;
  let match: RegExpExecArray | null;
  while ((match = circleRe.exec(svg))) {
    const tag = match[0];
    const cy = attr(tag, "cy");
    const cx = attr(tag, "cx");
    if (cy == null || cx == null || cy < fieldBottom + 20) continue;
    if (firstIdx < 0) firstIdx = match.index;
    minCx = Math.min(minCx, cx);
  }
  if (firstIdx < 0 || minCx >= viewMinX + 4) return svg;

  const dx = round(viewMinX + 8 - minCx);
  const overlayIdx = svg.indexOf('<g id="api-goal-overlay"');
  const end = overlayIdx > firstIdx ? overlayIdx : svg.lastIndexOf("</svg>");
  if (end <= firstIdx) return svg;
  return `${svg.slice(0, firstIdx)}<g id="diagram-legend-fit" transform="translate(${dx},0)">${svg.slice(firstIdx, end)}</g>${svg.slice(end)}`;
}

function parseViewBox(svgOrBox: string): { minX: number; minY: number; width: number; height: number } | null {
  const raw = /viewBox="([^"]+)"/.test(svgOrBox)
    ? svgOrBox.match(/viewBox="([^"]+)"/)?.[1]
    : svgOrBox;
  if (!raw) return null;
  const [minX, minY, width, height] = raw.split(/\s+/).map(Number);
  if (![minX, minY, width, height].every(Number.isFinite)) return null;
  return { minX, minY, width, height };
}

function applySvgOpenTag(svg: string, viewBox: string): string {
  return svg.replace(/<svg\b[^>]*>/i, (openTag) => {
    let tag = /viewBox\s*=/.test(openTag)
      ? openTag.replace(/viewBox\s*=\s*["'][^"']*["']/i, `viewBox="${viewBox}"`)
      : openTag.replace(/<svg\b/i, `<svg viewBox="${viewBox}"`);
    if (!/\boverflow\s*=/i.test(tag)) {
      tag = tag.replace(/<svg\b/i, `<svg overflow="hidden"`);
    } else {
      tag = tag.replace(/\boverflow\s*=\s*["'][^"']*["']/i, `overflow="hidden"`);
    }
    if (!/preserveAspectRatio\s*=/i.test(tag)) {
      tag = tag.replace(/<svg\b/i, `<svg preserveAspectRatio="xMidYMid meet"`);
    }
    return tag;
  });
}

function alreadyClipped(svg: string): boolean {
  return /id="diagram-fit-clip-\d+"/.test(svg) && /clip-path="url\(#diagram-fit-clip-\d+\)"/.test(svg);
}

/**
 * A viewBox that does not start at 0,0 looks right-shifted in the card:
 * Safari/Chrome map overflow:hidden + clip-path in viewport space, so the
 * green pitch slides right while cones and the 80yd bar stay put. Rebase
 * the crop window to the origin and translate the drawing instead.
 */
function rebaseCropToOrigin(svg: string): string {
  const crop = parseViewBox(svg);
  if (!crop || (crop.minX === 0 && crop.minY === 0)) return svg;
  if (svg.includes('id="diagram-origin-fit"')) return svg;
  const width = round(crop.width);
  const height = round(crop.height);
  const dx = round(-crop.minX);
  const dy = round(-crop.minY);
  let next = applySvgOpenTag(svg, `0 0 ${width} ${height}`);
  next = next.replace(
    /(<clipPath id="diagram-fit-clip-\d+"><rect )x="[\d.]+" y="[\d.]+" width="[\d.]+" height="[\d.]+"/,
    `$1x="0" y="0" width="${width}" height="${height}"`
  );
  next = next.replace(
    new RegExp(
      `<rect x="${crop.minX}" y="${crop.minY}" width="${crop.width}" height="${crop.height}" fill="#08111f"`
    ),
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#08111f"`
  );
  next = next.replace(
    /(<g clip-path="url\(#diagram-fit-clip-\d+\)">)/,
    `$1<g id="diagram-origin-fit" transform="translate(${dx}, ${dy})">`
  );
  if (!next.includes('id="diagram-origin-fit"')) return next;
  return next.replace(/<\/svg>\s*$/i, "</g></svg>");
}

/** Crop by viewBox + overflow:hidden. clip-path in viewport space is what
 * made the green pitch slide right while cones and the yard bar stayed put. */
function clipToViewBox(svg: string, sourceViewBox: string): string {
  const crop = parseViewBox(sourceViewBox);
  if (!crop) return svg;
  if (alreadyClipped(svg) || svg.includes('id="diagram-origin-fit"')) return rebaseCropToOrigin(svg);
  const width = round(crop.width);
  const height = round(crop.height);
  let next = applySvgOpenTag(svg, `0 0 ${width} ${height}`);
  next = next.replace(/<rect\b[^>]*\bx="0"[^>]*\by="0"[^>]*width="800"[^>]*height="595"/i, (tag) =>
    tag.replace(/width="800"/, `width="${width}"`).replace(/height="595"/, `height="${height}"`)
  );
  const dx = round(-crop.minX);
  const dy = round(-crop.minY);
  if (/<\/defs>/i.test(next)) {
    next = next.replace(
      /<\/defs>/i,
      `</defs><g id="diagram-origin-fit" transform="translate(${dx}, ${dy})">`
    );
  } else {
    next = next.replace(
      /<svg\b[^>]*>/i,
      (openTag) => `${openTag}<g id="diagram-origin-fit" transform="translate(${dx}, ${dy})">`
    );
  }
  return next.replace(/<\/svg>\s*$/i, "</g></svg>");
}

function evalSvgMath(expr: string): number | null {
  const trimmed = expr.trim();
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (!/^[0-9+\-*/().\s]+$/.test(trimmed) || !/[+\-*/]/.test(trimmed.replace(/^-/, ""))) return null;
  try {
    const value = Function(`"use strict"; return (${trimmed})`)();
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function resolveSvgMathAttributes(svg: string): string {
  return svg.replace(
    /(\s(?:x|y|x1|x2|y1|y2|cx|cy|r|rx|ry|width|height|dx|dy)=")([^"]+)(")/gi,
    (full, prefix, value, suffix) => {
      const resolved = evalSvgMath(value);
      return resolved == null ? full : `${prefix}${round(resolved)}${suffix}`;
    }
  );
}

function stripOversizedZoneOverlays(svg: string): string {
  const pitch = pitchRectFromSvg(svg);
  const maxW = pitch ? pitch.w * 0.35 : 200;
  const maxH = pitch ? pitch.h * 0.45 : 140;
  let next = svg.replace(/<rect\b[^>]*fill="#10f0a0"[^>]*\/?>/gi, (tag) => {
    const width = attr(tag, "width") ?? 0;
    const height = attr(tag, "height") ?? 0;
    // Zone-reference pills are 44×12. Do not treat stroke-width's hyphen as math.
    if (height > 0 && height <= 16) return tag;
    if (width >= maxW || height >= maxH) return "";
    if (/\b(?:x|y|width|height)="[^"]*[+*/][^"]*"/.test(tag)) return "";
    return tag;
  });
  // Full-pitch "Match Area" is the practice field itself. Gemini still draws
  // a leftover pill above the touchline after the overlay rect is removed.
  next = next.replace(
    /<g>\s*<rect\b[^>]*\/?>\s*<text\b[^>]*>\s*Match Area\s*<\/text>\s*<\/g>/gi,
    ""
  );
  return next;
}

export function fitDiagramSvgViewBox(svg: string): string {
  if (!/<svg[\s>]/i.test(svg)) return svg;
  let next = stripOversizedZoneOverlays(resolveSvgMathAttributes(svg));
  if (alreadyClipped(next)) return rebaseCropToOrigin(next);
  const viewBox = diagramFittedViewBox(next);
  if (!viewBox) return next;
  const pitch = pitchRectFromSvg(next);
  if (pitch) {
    const minX = Number(viewBox.split(" ")[0]);
    next = shiftLegendIntoView(next, pitch.y + pitch.h, minX);
  }
  return clipToViewBox(next, viewBox);
}
