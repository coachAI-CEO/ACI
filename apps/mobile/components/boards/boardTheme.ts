/**
 * Visual contract for the mobile tactical board.
 * Players/ATT-DEF: mock pitch feel. Arrows/lines: web `TacticalBoardEditor` + `BoardToolbar`.
 *
 * Diagram space is always: x = width (0–100), y = length (0–100).
 * ATT attacks toward y=0 (up); DEF owns the top goal.
 *
 * The pitch SVG uses preserveAspectRatio="none" so grass fills the canvas.
 * Token ellipses / arrow heads compensate so shapes stay round on screen.
 */

import { defaultCurveControl, curveBulgeSign } from '@aci/shared';
import type { WebDiagramArrow, WebDiagramTeam } from '@aci/shared';

/** Player disc radius in diagram-x % — mock `r=3` on a 100×100 viewBox. */
export const TOKEN_RADIUS_PCT = 3;

export const PITCH_FILL = '#062816';
export const LINE_STROKE = 'rgba(255,255,255,0.32)';
export const TOKEN_STROKE = '#0b1220';

/**
 * With stretch-to-fill (`preserveAspectRatio="none"`), a circle in viewBox
 * space becomes an ellipse on screen. Return diagram-space `ry` so the disc
 * stays round after stretch — and after the optional HORIZONTAL 90° remap.
 *
 * VERTICAL (no remap): screen_rx = rx·W/100, screen_ry = ry·H/100
 *   → ry = rx · (W/H)
 *
 * HORIZONTAL (`matrix(0 -1 1 0 0 100)`): diagram-y → screen-x, diagram-x → screen-y
 *   → screen_rx = ry·W/100, screen_ry = rx·H/100
 *   → ry = rx · (H/W)
 */
export function tokenRadiusY(
  radiusX: number,
  canvasW: number,
  canvasH: number,
  orientation: 'HORIZONTAL' | 'VERTICAL' = 'VERTICAL'
): number {
  if (canvasW <= 0 || canvasH <= 0) return radiusX;
  const aspect = canvasW / canvasH;
  return orientation === 'HORIZONTAL' ? radiusX / aspect : radiusX * aspect;
}

/**
 * Canvas aspect passed into arrow-head compensation.
 * Same axis swap as {@link tokenRadiusY} under HORIZONTAL.
 */
export function stretchAspect(
  canvasW: number,
  canvasH: number,
  orientation: 'HORIZONTAL' | 'VERTICAL' = 'VERTICAL'
): number {
  if (canvasW <= 0 || canvasH <= 0) return 1;
  const aspect = canvasW / canvasH;
  return orientation === 'HORIZONTAL' ? 1 / aspect : aspect;
}

/** Predicted on-screen token radii (px) for roundness checks / tests. */
export function tokenScreenRadii(
  radiusX: number,
  canvasW: number,
  canvasH: number,
  orientation: 'HORIZONTAL' | 'VERTICAL' = 'VERTICAL'
): { screenRx: number; screenRy: number; diagramRy: number } {
  const diagramRy = tokenRadiusY(radiusX, canvasW, canvasH, orientation);
  if (orientation === 'HORIZONTAL') {
    return {
      diagramRy,
      screenRx: (diagramRy * canvasW) / 100,
      screenRy: (radiusX * canvasH) / 100,
    };
  }
  return {
    diagramRy,
    screenRx: (radiusX * canvasW) / 100,
    screenRy: (diagramRy * canvasH) / 100,
  };
}

export function teamFill(team: WebDiagramTeam | string | undefined): string {
  if (team === 'ATT') return '#22c55e';
  if (team === 'DEF') return '#ef4444';
  return '#f59e0b';
}

export function teamNumberFill(team: WebDiagramTeam | string | undefined): string {
  if (team === 'ATT') return '#052e16';
  if (team === 'DEF') return '#ffffff';
  return '#1a1303';
}

/** Geometry modes from web `BoardToolbar` `LineGeometry`. */
export type LineGeometry = 'straight' | 'curve' | 'freehand';

/**
 * Draw kinds for the Arrow tool.
 * - Coaching presets: pass / run / press
 * - Web line types: free / straight / arrow / dashed / curve / curve-rev
 */
export type LineDrawKind =
  | 'pass'
  | 'run'
  | 'press'
  | 'free'
  | 'straight'
  | 'arrow'
  | 'dashed'
  | 'curve'
  | 'curve-rev';

/** @deprecated Prefer `LineDrawKind`. */
export type ArrowDrawKind = LineDrawKind;

export const COACHING_DRAW_KINDS: { id: LineDrawKind; label: string; color: string }[] = [
  { id: 'pass', label: 'Pass', color: '#e5e7eb' },
  { id: 'run', label: 'Run', color: '#22c55e' },
  { id: 'press', label: 'Press', color: '#f97316' },
];

/** Web `LINE_ITEMS` — compact labels for the phone row. */
export const WEB_LINE_KINDS: { id: LineDrawKind; label: string; color: string }[] = [
  { id: 'free', label: 'Free', color: '#94a3b8' },
  { id: 'straight', label: 'Line', color: '#94a3b8' },
  { id: 'arrow', label: 'Arrow', color: '#e5e7eb' },
  { id: 'dashed', label: 'Dash', color: '#22c55e' },
  { id: 'curve', label: 'Curve', color: '#e5e7eb' },
  { id: 'curve-rev', label: 'Curve↺', color: '#e5e7eb' },
];

/** All create/edit chips (coaching first, then web line types). */
export const ARROW_DRAW_KINDS = [...COACHING_DRAW_KINDS, ...WEB_LINE_KINDS];

export function arrowKindLabel(kind: LineDrawKind): string {
  return ARROW_DRAW_KINDS.find((k) => k.id === kind)?.label ?? kind;
}

export type LineArrowMeta = Pick<WebDiagramArrow, 'type' | 'style' | 'weight' | 'arrowhead'> & {
  geometry: LineGeometry;
  curveBulge?: number;
  control?: { x: number; y: number };
};

/**
 * Default quadratic control for coaching run arrows (lateral bulge).
 * Prefer `defaultCurveControl` from shared for web curve modes.
 */
export function defaultRunControl(
  from: { x: number; y: number },
  to: { x: number; y: number }
): { x: number; y: number } {
  return {
    x: (from.x + to.x) / 2 + (from.x < to.x ? 6 : -6),
    y: (from.y + to.y) / 2,
  };
}

/**
 * Build create/edit fields for a draw kind.
 * Web modes mirror `lineToolToArrow` in `BoardToolbar.tsx`.
 */
export function lineMetaFromKind(
  kind: LineDrawKind,
  from?: { x: number; y: number },
  to?: { x: number; y: number }
): LineArrowMeta {
  if (kind === 'free') {
    return {
      type: 'transition',
      style: 'solid',
      weight: 'normal',
      arrowhead: false,
      geometry: 'freehand',
    };
  }
  if (kind === 'straight') {
    return {
      type: 'transition',
      style: 'solid',
      weight: 'normal',
      arrowhead: false,
      geometry: 'straight',
    };
  }
  if (kind === 'arrow') {
    return {
      type: 'pass',
      style: 'solid',
      weight: 'normal',
      arrowhead: true,
      geometry: 'straight',
    };
  }
  if (kind === 'dashed') {
    return {
      type: 'run',
      style: 'dashed',
      weight: 'normal',
      arrowhead: false,
      geometry: 'straight',
    };
  }
  if (kind === 'curve' || kind === 'curve-rev') {
    const bulge = kind === 'curve' ? 0.28 : -0.28;
    return {
      type: 'pass',
      style: 'solid',
      weight: 'normal',
      arrowhead: true,
      geometry: 'curve',
      curveBulge: bulge,
      ...(from && to ? { control: defaultCurveControl(from, to, bulge) } : {}),
    };
  }
  if (kind === 'run') {
    return {
      type: 'run',
      style: 'dashed',
      weight: 'normal',
      arrowhead: true,
      geometry: 'curve',
      ...(from && to ? { control: defaultRunControl(from, to) } : {}),
    };
  }
  if (kind === 'press') {
    return {
      type: 'press',
      style: 'dashed',
      weight: 'bold',
      arrowhead: true,
      geometry: 'straight',
    };
  }
  // pass (coaching)
  return {
    type: 'pass',
    style: 'solid',
    weight: 'normal',
    arrowhead: true,
    geometry: 'straight',
  };
}

/** @deprecated Prefer `lineMetaFromKind`. */
export function arrowMetaFromKind(
  kind: LineDrawKind,
  from?: { x: number; y: number },
  to?: { x: number; y: number }
): LineArrowMeta {
  return lineMetaFromKind(kind, from, to);
}

/** Infer the closest draw kind for an existing arrow (edit dock). */
export function drawKindFromArrow(arrow: WebDiagramArrow): LineDrawKind {
  if (arrow.path && arrow.path.length >= 2) return 'free';
  if (arrow.type === 'press' || arrow.type === 'cover') return 'press';
  if (arrow.type === 'transition') {
    return arrow.arrowhead ? 'arrow' : 'straight';
  }
  if (arrow.type === 'run') {
    if (arrow.arrowhead === false && !arrow.control) return 'dashed';
    return 'run';
  }
  // pass / default
  if (arrow.control) {
    const from =
      arrow.from.x != null && arrow.from.y != null
        ? { x: arrow.from.x, y: arrow.from.y }
        : null;
    const to =
      arrow.to.x != null && arrow.to.y != null ? { x: arrow.to.x, y: arrow.to.y } : null;
    if (from && to) {
      return curveBulgeSign(from, to, arrow.control) >= 0 ? 'curve' : 'curve-rev';
    }
    return 'curve';
  }
  if (arrow.arrowhead === false) return 'straight';
  return 'pass';
}

/** Apply a draw kind onto an existing arrow (keeps endpoints). */
export function applyLineKindToArrow(
  arrow: WebDiagramArrow,
  kind: LineDrawKind,
  from: { x: number; y: number } | null,
  to: { x: number; y: number } | null
): WebDiagramArrow {
  const meta = lineMetaFromKind(kind, from || undefined, to || undefined);
  const next: WebDiagramArrow = {
    ...arrow,
    type: meta.type,
    style: meta.style,
    weight: meta.weight,
    arrowhead: meta.arrowhead,
    control: undefined,
    path: undefined,
  };
  if (meta.geometry === 'freehand') {
    // Keep a minimal path so it stays classified as free if endpoints exist.
    if (from && to) next.path = [from, to];
  } else if (meta.control) {
    next.control = meta.control;
  } else if (meta.geometry === 'curve' && from && to) {
    next.control = defaultCurveControl(from, to, meta.curveBulge ?? 0.28);
  }
  return next;
}

/** Web TacticalBoardEditor palette (not the HTML mock). */
export function arrowStroke(type: WebDiagramArrow['type'] | string | undefined): string {
  if (type === 'pass') return '#e5e7eb';
  if (type === 'run') return '#22c55e';
  if (type === 'press' || type === 'cover') return '#f97316';
  if (type === 'transition') return '#94a3b8';
  return '#94a3b8';
}

export function arrowDashArray(
  arrow: Pick<WebDiagramArrow, 'type' | 'style'>
): string | undefined {
  if (arrow.style === 'dotted') return '0.8 1.4';
  if (arrow.style === 'dashed') return '2.8 2';
  if (arrow.style === 'solid') return undefined;
  if (arrow.type === 'pass' || arrow.type === 'transition') return undefined;
  return '2.8 2';
}

export const ARROW_STROKE_WIDTH = 1.5;
/** Tip size in viewBox % — large enough to read on a stretched phone pitch. */
export const ARROW_HEAD_LEN = 4.2;

export const FREEHAND_SAMPLE_DIST = 1.2;
export const FREEHAND_MAX_POINTS = 100;

/**
 * Sharp triangular head at `to`.
 * `aspect` = canvasW/canvasH compensates preserveAspectRatio="none" stretch
 * so the tip stays roughly equilateral on screen.
 */
export function arrowHeadPoints(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  len = ARROW_HEAD_LEN,
  aspect = 1
): string {
  const ang = Math.atan2(toY - fromY, toX - fromX);
  const wing = 0.55;
  // Stretch y offsets inversely to canvas aspect so heads don't squash.
  const sy = aspect > 0 ? aspect : 1;
  const p1x = toX - len * Math.cos(ang - wing);
  const p1y = toY - (len / sy) * Math.sin(ang - wing);
  const p2x = toX - len * Math.cos(ang + wing);
  const p2y = toY - (len / sy) * Math.sin(ang + wing);
  return `${toX},${toY} ${p1x},${p1y} ${p2x},${p2y}`;
}

/** Pull shaft end back so the stroke doesn't bury the triangular tip. */
export function shaftEndBeforeHead(
  from: { x: number; y: number },
  to: { x: number; y: number },
  headLen = ARROW_HEAD_LEN
): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.5) return to;
  const pull = Math.min(headLen * 0.72, d * 0.45);
  return { x: to.x - (dx / d) * pull, y: to.y - (dy / d) * pull };
}

/**
 * Map stretched viewBox touch → diagram coords.
 * VERTICAL: 1:1. HORIZONTAL: screen (sx,sy) = (y, 100−x).
 */
export function screenToDiagram(
  sx: number,
  sy: number,
  orientation: 'HORIZONTAL' | 'VERTICAL'
): { x: number; y: number } {
  if (orientation === 'VERTICAL') return { x: sx, y: sy };
  return { x: 100 - sy, y: sx };
}

/** SVG transform putting diagram space onto a horizontal screen. */
export const HORIZONTAL_DIAGRAM_TRANSFORM = 'matrix(0 -1 1 0 0 100)';
