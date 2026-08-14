/** Crop unused canvas chrome so the green pitch fills the card.
 * Drawings sit on an 800-wide canvas with the field at ~x=118. A hardcoded
 * crop still left ~5% dark gutter, and the right goal made that look like a
 * right-shift. Crop to the actual pitch rect instead. */

const PITCH_FILL = "#1c5134";
const GOAL_STUB = 4;
const TOP_PAD = 40;
const BOTTOM_PAD = 140;
let clipSeq = 0;

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
  const minX = Math.max(0, pitch.x - GOAL_STUB);
  const minY = Math.max(0, pitch.y - TOP_PAD);
  const width = pitch.w + GOAL_STUB * 2;
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
    return tag;
  });
}

/** The 800-wide canvas still paints past the cropped viewBox unless clipped.
 * That leftover pitch/goal outline is the strip to the right of the green. */
function clipToViewBox(svg: string, viewBox: string): string {
  const [x, y, width, height] = viewBox.split(" ").map(Number);
  if (![x, y, width, height].every(Number.isFinite)) return svg;
  clipSeq += 1;
  const id = `diagram-fit-clip-${clipSeq}`;
  const clip = `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${width}" height="${height}"/></clipPath>`;
  let next = svg.replace(/<rect\b[^>]*\bx="0"[^>]*\by="0"[^>]*width="800"[^>]*height="595"/i, (tag) =>
    tag
      .replace(/\bx="0"/, `x="${x}"`)
      .replace(/\by="0"/, `y="${y}"`)
      .replace(/width="800"/, `width="${width}"`)
      .replace(/height="595"/, `height="${height}"`)
  );
  if (/<defs[\s>]/i.test(next)) {
    next = next.replace(/<defs\b[^>]*>/i, (defs) => `${defs}${clip}`);
  } else {
    next = next.replace(/<svg\b[^>]*>/i, (openTag) => `${openTag}<defs>${clip}</defs>`);
  }
  next = next.replace(/<\/defs>/i, `</defs><g clip-path="url(#${id})">`);
  return next.replace(/<\/svg>\s*$/i, "</g></svg>");
}

export function fitDiagramSvgViewBox(svg: string): string {
  if (!/<svg[\s>]/i.test(svg)) return svg;
  const viewBox = diagramFittedViewBox(svg);
  if (!viewBox) return svg;
  const pitch = pitchRectFromSvg(svg);
  let next = applySvgOpenTag(svg, viewBox);
  if (pitch) {
    const minX = Number(viewBox.split(" ")[0]);
    next = shiftLegendIntoView(next, pitch.y + pitch.h, minX);
  }
  return clipToViewBox(next, viewBox);
}
