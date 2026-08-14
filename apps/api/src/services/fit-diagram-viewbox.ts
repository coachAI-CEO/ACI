/** Crop unused canvas chrome so the green pitch fills the card.
 * Drawings sit on an 800-wide canvas with the field at ~x=118. A hardcoded
 * crop still left ~5% dark gutter, and the right goal made that look like a
 * right-shift. Crop to the actual pitch rect instead. */

const PITCH_FILL = "#1c5134";
const GOAL_STUB = 14;
const TOP_PAD = 40;
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

export function fitDiagramSvgViewBox(svg: string): string {
  if (!/<svg[\s>]/i.test(svg)) return svg;
  const viewBox = diagramFittedViewBox(svg);
  if (!viewBox) return svg;
  const pitch = pitchRectFromSvg(svg);
  let next = svg.replace(/<svg\b[^>]*>/i, (openTag) => {
    if (/viewBox\s*=/.test(openTag)) {
      return openTag.replace(/viewBox\s*=\s*["'][^"']*["']/i, `viewBox="${viewBox}"`);
    }
    return openTag.replace(/<svg\b/i, `<svg viewBox="${viewBox}"`);
  });
  if (pitch) {
    const minX = Number(viewBox.split(" ")[0]);
    next = shiftLegendIntoView(next, pitch.y + pitch.h, minX);
  }
  return next;
}
