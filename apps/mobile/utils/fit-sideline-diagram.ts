/** Tighter pitch crop for Sideline — server fit still leaves large label/legend gutters.
 * RN SvgXml (like Safari) mishandles non-zero viewBox origins, so we rebase to 0,0
 * and adjust the origin-fit translate — same approach as apps/api fit-diagram-viewbox.
 */

const PITCH_FILL = '#1c5134';
/** Balanced crop: trim server gutters without clipping goals/legend. */
const GOAL_STUB = 56;
const TOP_PAD = 60;
const BOTTOM_PAD = 120;

function attr(tag: string, name: string): number | null {
  const match = tag.match(new RegExp(`\\b${name}="([\\d.]+)"`, 'i'));
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseViewBox(svg: string): { minX: number; minY: number; width: number; height: number } | null {
  const raw = svg.match(/viewBox\s*=\s*["']([^"']+)["']/i)?.[1];
  if (!raw) return null;
  const [minX, minY, width, height] = raw.split(/[\s,]+/).map(Number);
  if (![minX, minY, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  return { minX, minY, width, height };
}

function pitchRectFromSvg(svg: string): { x: number; y: number; w: number; h: number } | null {
  const tag = svg.match(new RegExp(`<rect\\b[^>]*fill="${PITCH_FILL}"[^>]*>`, 'i'))?.[0];
  if (!tag) return null;
  const x = attr(tag, 'x');
  const y = attr(tag, 'y');
  const w = attr(tag, 'width');
  const h = attr(tag, 'height');
  if (x == null || y == null || w == null || h == null || w < 10 || h < 10) return null;
  return { x, y, w, h };
}

function originTranslate(svg: string): { dx: number; dy: number } {
  const match = svg.match(
    /id="diagram-origin-fit"[^>]*transform="translate\(\s*([^,\s]+)\s*,\s*([^)\s]+)\s*\)"/i
  );
  if (!match) return { dx: 0, dy: 0 };
  const dx = Number(match[1]);
  const dy = Number(match[2]);
  return {
    dx: Number.isFinite(dx) ? dx : 0,
    dy: Number.isFinite(dy) ? dy : 0,
  };
}

function applyOpenTag(svg: string, viewBox: string): string {
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
    } else {
      tag = tag.replace(
        /preserveAspectRatio\s*=\s*["'][^"']*["']/i,
        `preserveAspectRatio="xMidYMid meet"`
      );
    }
    return tag;
  });
}

export type FittedSidelineDiagram = {
  svg: string;
  aspect: number;
};

/** Crop toward the green pitch so Sideline uses less empty canvas chrome. */
export function fitSidelineDiagramSvg(svg: string): FittedSidelineDiagram {
  const fallbackAspect = 4 / 3;
  if (!svg || !/<svg[\s>]/i.test(svg)) {
    return { svg, aspect: fallbackAspect };
  }

  const view = parseViewBox(svg);
  const pitch = pitchRectFromSvg(svg);
  if (!view || !pitch) {
    return { svg, aspect: view ? view.width / view.height : fallbackAspect };
  }

  const { dx, dy } = originTranslate(svg);
  const visualX = pitch.x + dx;
  const visualY = pitch.y + dy;

  let cropX = Math.max(view.minX, visualX - GOAL_STUB);
  let cropY = Math.max(view.minY, visualY - TOP_PAD);
  let width = pitch.w + GOAL_STUB * 2;
  let height = pitch.h + TOP_PAD + BOTTOM_PAD;

  const viewRight = view.minX + view.width;
  const viewBottom = view.minY + view.height;
  if (cropX + width > viewRight) width = Math.max(40, viewRight - cropX);
  if (cropY + height > viewBottom) height = Math.max(40, viewBottom - cropY);
  if (cropX + width > viewRight) cropX = Math.max(view.minX, viewRight - width);
  if (cropY + height > viewBottom) cropY = Math.max(view.minY, viewBottom - height);

  width = round(width);
  height = round(height);
  cropX = round(cropX);
  cropY = round(cropY);

  const nextDx = round(dx - cropX);
  const nextDy = round(dy - cropY);
  const box = `0 0 ${width} ${height}`;

  let next = applyOpenTag(svg, box);

  if (/id="diagram-origin-fit"/i.test(next)) {
    next = next.replace(
      /id="diagram-origin-fit"[^>]*transform="translate\(\s*[^)]+\)"/i,
      `id="diagram-origin-fit" transform="translate(${nextDx}, ${nextDy})"`
    );
  } else if (/<g clip-path="url\(#diagram-fit-clip-\d+\)">/i.test(next)) {
    next = next.replace(
      /(<g clip-path="url\(#diagram-fit-clip-\d+\)">)/i,
      `$1<g id="diagram-origin-fit" transform="translate(${nextDx}, ${nextDy})">`
    );
    next = next.replace(/<\/svg>\s*$/i, '</g></svg>');
  } else {
    next = next.replace(
      /(<svg\b[^>]*>)/i,
      `$1<g id="diagram-origin-fit" transform="translate(${nextDx}, ${nextDy})">`
    );
    next = next.replace(/<\/svg>\s*$/i, '</g></svg>');
  }

  next = next.replace(
    /(<clipPath id="diagram-fit-clip-\d+"><rect )[^>]*(\/>)/i,
    `$1x="0" y="0" width="${width}" height="${height}"$2`
  );

  return { svg: next, aspect: width / Math.max(height, 1) };
}
