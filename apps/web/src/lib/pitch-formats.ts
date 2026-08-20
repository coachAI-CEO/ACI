/**
 * Age-group pitch specs from standard youth field diagrams (larger end of ranges).
 * Used so markings, aspect ratio, and zoom stay at real-world scale.
 */

export type PitchFormatId = "7V7" | "9V9" | "11V11";
export type PitchZoom = "FULL" | "HALF" | "THIRD";

export type PitchMarkingSpec = {
  id: PitchFormatId;
  label: string;
  ages: string;
  /** Touch line (goal → goal) */
  lengthYards: number;
  /** Goal line (touchline → touchline) */
  widthYards: number;
  centerCircleRadiusYds: number;
  penaltyDepthYds: number;
  penaltyWidthYds: number;
  goalAreaDepthYds: number;
  goalAreaWidthYds: number;
  penaltySpotYds: number;
  penaltyArcRadiusYds: number;
  cornerArcRadiusYds: number;
  goalWidthFt: number;
  goalHeightFt: number;
  /** 7v7 only: lines at 1/3 and 2/3 length */
  buildOutLines: boolean;
};

/** Larger end of published ranges — matches apps/api field-dimensions.ts overall size. */
export const PITCH_SPECS: Record<PitchFormatId, PitchMarkingSpec> = {
  "7V7": {
    id: "7V7",
    label: "7v7",
    ages: "U8–U10",
    lengthYards: 65,
    widthYards: 45,
    centerCircleRadiusYds: 8,
    penaltyDepthYds: 12,
    penaltyWidthYds: 24,
    goalAreaDepthYds: 4,
    goalAreaWidthYds: 8,
    penaltySpotYds: 10,
    penaltyArcRadiusYds: 8,
    cornerArcRadiusYds: 1,
    goalWidthFt: 21,
    goalHeightFt: 7,
    buildOutLines: true,
  },
  "9V9": {
    id: "9V9",
    label: "9v9",
    ages: "U11–U12",
    lengthYards: 80,
    widthYards: 55,
    centerCircleRadiusYds: 8,
    penaltyDepthYds: 14,
    penaltyWidthYds: 36,
    goalAreaDepthYds: 5,
    goalAreaWidthYds: 12,
    penaltySpotYds: 10,
    penaltyArcRadiusYds: 8,
    cornerArcRadiusYds: 1,
    goalWidthFt: 21,
    goalHeightFt: 7,
    buildOutLines: false,
  },
  "11V11": {
    id: "11V11",
    label: "11v11",
    ages: "U13+",
    lengthYards: 120,
    widthYards: 80,
    centerCircleRadiusYds: 10,
    penaltyDepthYds: 18,
    penaltyWidthYds: 44,
    goalAreaDepthYds: 6,
    goalAreaWidthYds: 20,
    penaltySpotYds: 12,
    penaltyArcRadiusYds: 10,
    cornerArcRadiusYds: 1,
    goalWidthFt: 24,
    goalHeightFt: 8,
    buildOutLines: false,
  },
};

export const PITCH_FORMAT_OPTIONS: { id: PitchFormatId; label: string; ages: string }[] = [
  { id: "7V7", label: "7v7", ages: "U8–U10" },
  { id: "9V9", label: "9v9", ages: "U11–U12" },
  { id: "11V11", label: "11v11", ages: "U13+" },
];

export function formatFromAgeGroup(ageGroup: string | null | undefined): PitchFormatId {
  const m = String(ageGroup || "").trim().toUpperCase().match(/U?(\d{1,2})/);
  const n = m ? Number(m[1]) : NaN;
  if (!Number.isFinite(n)) return "11V11";
  if (n <= 10) return "7V7";
  if (n <= 12) return "9V9";
  return "11V11";
}

/** Visible window into the full pitch, in yards. Length axis = goal→goal. */
export type PitchViewport = {
  originLengthYds: number;
  originWidthYds: number;
  lengthYds: number;
  widthYds: number;
};

/**
 * Zoom crops along the length from the left (away) goal so markings stay
 * yard-accurate. FULL = whole pitch; HALF / THIRD = that fraction of length.
 */
export function pitchChromeLabel(
  zoom: PitchZoom,
  areaLabel?: string | null,
  opts?: { playerCount?: number; hasMiniGoals?: boolean }
): string {
  const a = String(areaLabel || "").toLowerCase();
  if (a.includes("rondo")) return "Rondo";
  if (a.includes("ssg")) return "SSG";
  if (opts?.hasMiniGoals && (opts.playerCount || 0) > 0 && (opts.playerCount || 0) <= 12) {
    return "Rondo";
  }
  if (zoom === "HALF") return "Half";
  if (zoom === "THIRD") return "Third";
  return "Full";
}

export function viewportFor(format: PitchFormatId, zoom: PitchZoom): PitchViewport {
  const spec = PITCH_SPECS[format];
  const lengthYds =
    zoom === "FULL" ? spec.lengthYards : zoom === "HALF" ? spec.lengthYards / 2 : spec.lengthYards / 3;
  return {
    originLengthYds: 0,
    originWidthYds: 0,
    lengthYds,
    widthYds: spec.widthYards,
  };
}

export type PitchLayout = {
  left: number;
  top: number;
  width: number;
  height: number;
  yardsPerPx: number;
};

/** Fit the viewport into the canvas while preserving length:width aspect. */
export function layoutPitch(
  canvasW: number,
  canvasH: number,
  margin: number,
  viewport: PitchViewport
): PitchLayout {
  const availW = canvasW - margin * 2;
  const availH = canvasH - margin * 2;
  const aspect = viewport.lengthYds / viewport.widthYds; // horizontal: wider when FULL

  let width = availW;
  let height = width / aspect;
  if (height > availH) {
    height = availH;
    width = height * aspect;
  }

  return {
    left: (canvasW - width) / 2,
    top: (canvasH - height) / 2,
    width,
    height,
    yardsPerPx: viewport.lengthYds / width,
  };
}

/** Map a full-pitch yard point into the current viewport as 0–100 diagram % (length=y, width=x). */
export function yardsToDiagramPercent(
  lengthYds: number,
  widthYds: number,
  viewport: PitchViewport
): { x: number; y: number } | null {
  const y = ((lengthYds - viewport.originLengthYds) / viewport.lengthYds) * 100;
  const x = ((widthYds - viewport.originWidthYds) / viewport.widthYds) * 100;
  if (y < -5 || y > 105 || x < -5 || x > 105) return null;
  return {
    x: Math.max(0, Math.min(100, x)),
    y: Math.max(0, Math.min(100, y)),
  };
}

export function tokenRadiusPx(layout: PitchLayout, fullLengthYards = 120): number {
  // ~3% of full pitch length (20% larger than prior 2.5% chip scale)
  const diameterYds = fullLengthYards * 0.03;
  const r = diameterYds / 2 / layout.yardsPerPx;
  return Math.max(10, Math.min(22, r));
}

export function ballRadiusPx(playerRadius: number): number {
  return Math.max(5, playerRadius * 0.55);
}
