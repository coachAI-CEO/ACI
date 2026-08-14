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

function pitchRectFromSvg(svg: string): { x: number; y: number; w: number; h: number } | null {
  const tag = svg.match(new RegExp(`<rect\\b[^>]*fill="${PITCH_FILL}"[^>]*>`, "i"))?.[0];
  if (!tag) return null;
  const x = attr(tag, "x");
  const y = attr(tag, "y");
  const w = attr(tag, "width");
  const h = attr(tag, "height");
  if (x == null || y == null || w == null || h == null || w < 10 || h < 10) return null;
  return { x, y, w, h };
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

function alreadyClipped(svg: string): boolean {
  return /id="diagram-fit-clip-\d+"/.test(svg) && /clip-path="url\(#diagram-fit-clip-\d+\)"/.test(svg);
}

function clipToViewBox(svg: string, viewBox: string): string {
  if (alreadyClipped(svg)) return svg;
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
  if (next.includes(`clip-path="url(#${id})"`)) return next;
  next = next.replace(/<\/defs>/i, `</defs><g clip-path="url(#${id})">`);
  return next.replace(/<\/svg>\s*$/i, "</g></svg>");
}

export function fitDiagramSvgViewBox(svg: string): string {
  if (!/<svg[\s>]/i.test(svg)) return svg;
  if (alreadyClipped(svg)) return svg;
  const pitch = pitchRectFromSvg(svg);
  const viewBox = pitch
    ? `${round(Math.max(0, pitch.x - GOAL_STUB))} ${round(Math.max(0, pitch.y - TOP_PAD))} ${round(pitch.w + GOAL_STUB * 2)} ${round(pitch.h + TOP_PAD + BOTTOM_PAD)}`
    : null;

  let next = svg.replace(/<svg\b[^>]*>/i, (openTag) => {
    let tag = openTag;
    if (viewBox) {
      tag = /viewBox\s*=/.test(tag)
        ? tag.replace(/viewBox\s*=\s*["'][^"']*["']/i, `viewBox="${viewBox}"`)
        : tag.replace(/<svg\b/i, `<svg viewBox="${viewBox}"`);
    }
    if (!/\boverflow\s*=/i.test(tag)) {
      tag = tag.replace(/<svg\b/i, `<svg overflow="hidden"`);
    } else {
      tag = tag.replace(/\boverflow\s*=\s*["'][^"']*["']/i, `overflow="hidden"`);
    }
    if (!/preserveAspectRatio\s*=/i.test(tag)) {
      tag = tag.replace(/<svg\b/i, `<svg preserveAspectRatio="xMidYMid meet"`);
    }
    if (!/\bwidth\s*=/i.test(tag)) {
      tag = tag.replace(/<svg\b/i, `<svg width="100%"`);
    }
    if (!/\bstyle\s*=/i.test(tag)) {
      tag = tag.replace(/<svg\b/i, `<svg style="overflow:hidden;max-width:100%;display:block"`);
    }
    return tag;
  });

  if (pitch && viewBox) {
    const minX = Number(viewBox.split(" ")[0]);
    next = shiftLegendIntoView(next, pitch.y + pitch.h, minX);
    next = clipToViewBox(next, viewBox);
  }
  return next;
}

/** Pick a stored Gemini/deterministic SVG off a drill or session-json drill. */
export function pickDrillDiagramSvg(source: unknown): string | null {
  if (!source || typeof source !== "object") return null;
  const record = source as Record<string, unknown>;
  const nested =
    record.json && typeof record.json === "object"
      ? (record.json as Record<string, unknown>)
      : null;
  for (const value of [record.diagramSvg, nested?.diagramSvg]) {
    if (typeof value === "string" && /<svg[\s>]/i.test(value)) return value;
  }
  return null;
}

/**
 * Vault list drills use `${sessionId}-${index}` as a UI id. That is not a
 * Drill row, so SVG lookup must prefer refCode.
 */
export function pickDrillSvgId(source: unknown): string | null {
  if (!source || typeof source !== "object") return null;
  const record = source as Record<string, unknown>;
  const nested =
    record.json && typeof record.json === "object"
      ? (record.json as Record<string, unknown>)
      : null;
  for (const value of [record.refCode, nested?.refCode, record.id]) {
    if (typeof value !== "string" || !value.trim()) continue;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-\d+$/i.test(value)) {
      continue;
    }
    return value;
  }
  return null;
}

export function sessionDrillsHaveStoredSvgs(session: unknown): boolean {
  if (!session || typeof session !== "object") return false;
  const json = (session as Record<string, unknown>).json;
  const drills =
    json && typeof json === "object" && Array.isArray((json as Record<string, unknown>).drills)
      ? ((json as Record<string, unknown>).drills as unknown[])
      : [];
  if (drills.length === 0) return true;
  return drills.every((drill) => {
    if (!drill || typeof drill !== "object") return true;
    const drillType = String((drill as Record<string, unknown>).drillType || "").toUpperCase();
    if (drillType === "COOLDOWN") return true;
    return Boolean(pickDrillDiagramSvg(drill));
  });
}

function diagramAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof window === "undefined") return headers;
  const accessToken = localStorage.getItem("accessToken");
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

export async function fetchStoredDiagramSvgs(ids: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(ids.filter((id) => typeof id === "string" && id.trim())));
  if (unique.length === 0) return {};
  const res = await fetch("/api/diagram-svg/lookup", {
    method: "POST",
    credentials: "include",
    headers: diagramAuthHeaders(),
    body: JSON.stringify({ ids: unique }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.svgs || typeof data.svgs !== "object") return {};
  const svgs: Record<string, string> = {};
  for (const [key, value] of Object.entries(data.svgs as Record<string, unknown>)) {
    if (typeof value === "string" && /<svg[\s>]/i.test(value)) svgs[key] = value;
  }
  return svgs;
}

export function mergeSessionDrillSvgs<T extends { json?: any }>(
  session: T,
  svgs: Record<string, string>
): T {
  const drills = Array.isArray(session.json?.drills) ? session.json.drills : [];
  return {
    ...session,
    json: {
      ...session.json,
      drills: drills.map((drill: unknown) => {
        if (!drill || typeof drill !== "object") return drill;
        const id = pickDrillSvgId(drill);
        const svg = (id && svgs[id]) || pickDrillDiagramSvg(drill);
        return svg ? { ...(drill as Record<string, unknown>), diagramSvg: svg } : drill;
      }),
    },
  };
}
