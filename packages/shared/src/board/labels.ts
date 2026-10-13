import type { WebDiagramLabel } from '../types/tactical-board';

const clamp = (n: number) => Math.max(4, Math.min(96, n));

function roughlySame(a: number, b: number, tol: number) {
  return Math.abs(a - b) <= tol;
}

/** True when two+ labels sit close enough to look stacked on screen. */
export function labelsOverlap(
  labels: WebDiagramLabel[] | null | undefined,
  tol = 6
): boolean {
  const list = labels || [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (
        roughlySame(list[i].x, list[j].x, tol) &&
        roughlySame(list[i].y, list[j].y, tol)
      ) {
        return true;
      }
      // Long chips on the same row also collide on VERTICAL boards.
      if (
        roughlySame(list[i].y, list[j].y, 4) &&
        Math.abs(list[i].x - list[j].x) < 28
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Spread coaching captions so they don't pile up.
 * VERTICAL (mobile default): column on the opposite flank, spaced down the pitch.
 * HORIZONTAL: row along the length axis (web default intent).
 */
export function separateOverlappingLabels(
  labels: WebDiagramLabel[] | null | undefined,
  orientation: 'HORIZONTAL' | 'VERTICAL' = 'VERTICAL'
): WebDiagramLabel[] {
  const list = (labels || []).map((l) => ({ ...l }));
  if (list.length < 2) return list;
  if (!labelsOverlap(list)) return list;

  const order = list
    .map((l, index) => ({ l, index }))
    .sort((a, b) => a.l.y - b.l.y || a.l.x - b.l.x);

  if (orientation === 'VERTICAL') {
    const avgX = list.reduce((s, l) => s + (l.x || 0), 0) / list.length;
    const colX = avgX >= 50 ? 84 : 16;
    const minY = Math.min(...list.map((l) => l.y || 50));
    const startY = clamp(Math.max(14, minY));
    const gap = 12;
    for (let rank = 0; rank < order.length; rank++) {
      const { index } = order[rank];
      list[index] = {
        ...list[index],
        x: colX,
        y: clamp(startY + rank * gap),
      };
    }
    return list;
  }

  const avgY = list.reduce((s, l) => s + (l.y || 0), 0) / list.length;
  const rowY = clamp(avgY);
  const preferHighX = list.reduce((s, l) => s + (l.x || 0), 0) / list.length >= 50;
  const startX = preferHighX ? 90 : 12;
  const dir = preferHighX ? -1 : 1;
  const gap = 14;
  for (let rank = 0; rank < order.length; rank++) {
    const { index } = order[rank];
    list[index] = {
      ...list[index],
      x: clamp(startX + dir * rank * gap),
      y: rowY,
    };
  }
  return list;
}
