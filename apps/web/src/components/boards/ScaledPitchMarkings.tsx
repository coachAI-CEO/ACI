import type { DiagramV1 } from "@/types/diagram";
import {
  PITCH_SPECS,
  type PitchFormatId,
  type PitchLayout,
  type PitchViewport,
  yardsToDiagramPercent,
} from "@/lib/pitch-formats";

const LINE = "#e5e7eb";

type Props = {
  format: PitchFormatId;
  orientation: DiagramV1["pitch"]["orientation"];
  layout: PitchLayout;
  viewport: PitchViewport;
  /** Five-lane field segregation (wide / half-space / centre). */
  showLanes?: boolean;
};

/**
 * Pitch markings from real yard specs, clipped to the zoom viewport so
 * Full / Half / Third and 7v7 / 9v9 / 11v11 stay at true scale.
 */
export default function ScaledPitchMarkings({
  format,
  orientation,
  layout,
  viewport,
  showLanes = false,
}: Props) {
  const spec = PITCH_SPECS[format];
  const horizontal = orientation !== "VERTICAL";

  const toScreen = (lengthYds: number, widthYds: number) => {
    const pct = yardsToDiagramPercent(lengthYds, widthYds, viewport);
    if (!pct) return null;
    if (horizontal) {
      return {
        sx: layout.left + (pct.y / 100) * layout.width,
        sy: layout.top + ((100 - pct.x) / 100) * layout.height,
      };
    }
    return {
      sx: layout.left + (pct.x / 100) * layout.width,
      sy: layout.top + (pct.y / 100) * layout.height,
    };
  };

  const lenToPx = (yards: number) => yards / layout.yardsPerPx;
  const widToPx = (yards: number) => yards / (viewport.widthYds / layout.height);

  const goalDepthPx = Math.max(8, lenToPx(2.5));
  const goalWidthYds = spec.goalWidthFt / 3; // 3 ft = 1 yd
  const goalWidthPx = widToPx(goalWidthYds);

  const midL = spec.lengthYards / 2;
  const midW = spec.widthYards / 2;
  const centerR = lenToPx(spec.centerCircleRadiusYds);

  const arcPath = (spotLen: number, towardPositiveLength: boolean): string | null => {
    const boxEdgeLen = towardPositiveLength
      ? spec.penaltyDepthYds
      : spec.lengthYards - spec.penaltyDepthYds;
    const steps: string[] = [];
    for (let a = -70; a <= 70; a += 5) {
      const rad = (a * Math.PI) / 180;
      const dLen =
        Math.cos(rad) * spec.penaltyArcRadiusYds * (towardPositiveLength ? 1 : -1);
      const dWid = Math.sin(rad) * spec.penaltyArcRadiusYds;
      const len = spotLen + dLen;
      const outside = towardPositiveLength ? len >= boxEdgeLen : len <= boxEdgeLen;
      if (!outside) continue;
      const p = toScreen(len, midW + dWid);
      if (!p) continue;
      steps.push(`${steps.length === 0 ? "M" : "L"} ${p.sx} ${p.sy}`);
    }
    return steps.length > 1 ? steps.join(" ") : null;
  };

  const cornerArc = (lengthYds: number, widthYds: number, quad: 1 | 2 | 3 | 4) => {
    const pts: string[] = [];
    for (let a = 0; a <= 90; a += 10) {
      const rad = (a * Math.PI) / 180;
      let dL = 0;
      let dW = 0;
      if (quad === 1) {
        dL = Math.sin(rad) * spec.cornerArcRadiusYds;
        dW = Math.cos(rad) * spec.cornerArcRadiusYds;
      } else if (quad === 2) {
        dL = -Math.cos(rad) * spec.cornerArcRadiusYds;
        dW = Math.sin(rad) * spec.cornerArcRadiusYds;
      } else if (quad === 3) {
        dL = -Math.sin(rad) * spec.cornerArcRadiusYds;
        dW = -Math.cos(rad) * spec.cornerArcRadiusYds;
      } else {
        dL = Math.cos(rad) * spec.cornerArcRadiusYds;
        dW = -Math.sin(rad) * spec.cornerArcRadiusYds;
      }
      const p = toScreen(lengthYds + dL, widthYds + dW);
      if (!p) continue;
      pts.push(`${pts.length === 0 ? "M" : "L"} ${p.sx} ${p.sy}`);
    }
    return pts.length > 1 ? pts.join(" ") : null;
  };

  const endBox = (atLeft: boolean) => {
    const depth = spec.penaltyDepthYds;
    const six = spec.goalAreaDepthYds;
    const originLen = atLeft ? 0 : spec.lengthYards - depth;
    const sixOrigin = atLeft ? 0 : spec.lengthYards - six;

    const penTL = toScreen(originLen, midW - spec.penaltyWidthYds / 2);
    const penBR = toScreen(originLen + depth, midW + spec.penaltyWidthYds / 2);
    const sixTL = toScreen(sixOrigin, midW - spec.goalAreaWidthYds / 2);
    const sixBR = toScreen(sixOrigin + six, midW + spec.goalAreaWidthYds / 2);
    const spot = toScreen(
      atLeft ? spec.penaltySpotYds : spec.lengthYards - spec.penaltySpotYds,
      midW
    );
    const goalInner = toScreen(atLeft ? 0 : spec.lengthYards, midW);
    if (!penTL || !penBR || !sixTL || !sixBR || !goalInner) return null;

    const penX = Math.min(penTL.sx, penBR.sx);
    const penY = Math.min(penTL.sy, penBR.sy);
    const sixX = Math.min(sixTL.sx, sixBR.sx);
    const sixY = Math.min(sixTL.sy, sixBR.sy);

    return (
      <g key={atLeft ? "left-box" : "right-box"}>
        <rect
          x={penX}
          y={penY}
          width={Math.abs(penBR.sx - penTL.sx)}
          height={Math.abs(penBR.sy - penTL.sy)}
          fill="none"
          stroke={LINE}
          strokeWidth={1.75}
        />
        <rect
          x={sixX}
          y={sixY}
          width={Math.abs(sixBR.sx - sixTL.sx)}
          height={Math.abs(sixBR.sy - sixTL.sy)}
          fill="none"
          stroke={LINE}
          strokeWidth={1.75}
        />
        <rect
          x={atLeft ? goalInner.sx - goalDepthPx : goalInner.sx}
          y={goalInner.sy - goalWidthPx / 2}
          width={goalDepthPx}
          height={goalWidthPx}
          fill="none"
          stroke={LINE}
          strokeWidth={2.5}
        />
        {spot ? <circle cx={spot.sx} cy={spot.sy} r={2.5} fill={LINE} /> : null}
        {(() => {
          const d = arcPath(
            atLeft ? spec.penaltySpotYds : spec.lengthYards - spec.penaltySpotYds,
            atLeft
          );
          return d ? <path d={d} fill="none" stroke={LINE} strokeWidth={1.5} /> : null;
        })()}
      </g>
    );
  };

  const leftVisible = viewport.originLengthYds <= spec.penaltyDepthYds + 1;
  const rightVisible =
    viewport.originLengthYds + viewport.lengthYds >=
    spec.lengthYards - spec.penaltyDepthYds - 1;
  const midVisible =
    viewport.originLengthYds < midL && viewport.originLengthYds + viewport.lengthYds > midL;

  const buildOutAt = (frac: number) => {
    const len = spec.lengthYards * frac;
    const a = toScreen(len, 0);
    const b = toScreen(len, spec.widthYards);
    if (!a || !b) return null;
    return (
      <line
        key={`bo-${frac}`}
        x1={a.sx}
        y1={a.sy}
        x2={b.sx}
        y2={b.sy}
        stroke={LINE}
        strokeWidth={1.25}
        strokeDasharray="6 8"
        opacity={0.7}
      />
    );
  };

  const center = toScreen(midL, midW);

  // Lane boundaries from penalty / 6-yard widths (goal → goal bands across the pitch)
  const penHalf = spec.penaltyWidthYds / 2;
  const sixHalf = spec.goalAreaWidthYds / 2;
  const laneBands: Array<{
    id: string;
    w0: number;
    w1: number;
    highlight?: boolean;
  }> = [
    { id: "wide-top", w0: 0, w1: midW - penHalf },
    {
      id: "half-top",
      w0: midW - penHalf,
      w1: midW - sixHalf,
      highlight: true,
    },
    { id: "centre", w0: midW - sixHalf, w1: midW + sixHalf },
    {
      id: "half-bot",
      w0: midW + sixHalf,
      w1: midW + penHalf,
      highlight: true,
    },
    { id: "wide-bot", w0: midW + penHalf, w1: spec.widthYards },
  ];

  const renderLanes = () => {
    if (!showLanes) return null;
    const len0 = viewport.originLengthYds;
    const len1 = viewport.originLengthYds + viewport.lengthYds;
    const boundaries = [0, midW - penHalf, midW - sixHalf, midW + sixHalf, midW + penHalf, spec.widthYards];

    return (
      <g>
        {laneBands.map((band) => {
          if (!band.highlight) return null;
          const a = toScreen(len0, band.w0);
          const b = toScreen(len1, band.w1);
          if (!a || !b) return null;
          const x = Math.min(a.sx, b.sx);
          const y = Math.min(a.sy, b.sy);
          const w = Math.abs(b.sx - a.sx);
          const h = Math.abs(b.sy - a.sy);
          return (
            <rect
              key={band.id}
              x={x}
              y={y}
              width={w}
              height={h}
              fill="rgba(255, 255, 255, 0.08)"
            />
          );
        })}
        {boundaries.map((wYds, i) => {
          if (i === 0 || i === boundaries.length - 1) return null;
          const p0 = toScreen(len0, wYds);
          const p1 = toScreen(len1, wYds);
          if (!p0 || !p1) return null;
          return (
            <line
              key={`lane-div-${i}`}
              x1={p0.sx}
              y1={p0.sy}
              x2={p1.sx}
              y2={p1.sy}
              stroke="rgba(226, 232, 240, 0.55)"
              strokeWidth={1}
              strokeDasharray="5 6"
            />
          );
        })}
      </g>
    );
  };

  return (
    <g className="pointer-events-none">
      <rect
        x={layout.left}
        y={layout.top}
        width={layout.width}
        height={layout.height}
        rx={4}
        fill="#166534"
        stroke={LINE}
        strokeWidth={2}
      />

      {renderLanes()}

      {midVisible && center ? (
        <>
          {(() => {
            const a = toScreen(midL, 0);
            const b = toScreen(midL, spec.widthYards);
            if (!a || !b) return null;
            return (
              <line
                x1={a.sx}
                y1={a.sy}
                x2={b.sx}
                y2={b.sy}
                stroke={LINE}
                strokeWidth={1.75}
              />
            );
          })()}
          <circle
            cx={center.sx}
            cy={center.sy}
            r={centerR}
            fill="none"
            stroke={LINE}
            strokeWidth={1.75}
          />
          <circle cx={center.sx} cy={center.sy} r={2.5} fill={LINE} />
        </>
      ) : null}

      {!midVisible &&
        Math.abs(viewport.originLengthYds + viewport.lengthYds - midL) < 0.75 &&
        (() => {
          const a = toScreen(midL, midW - spec.centerCircleRadiusYds);
          const b = toScreen(midL, midW + spec.centerCircleRadiusYds);
          if (!a || !b) return null;
          return (
            <path
              d={`M ${a.sx} ${a.sy} A ${centerR} ${centerR} 0 0 0 ${b.sx} ${b.sy}`}
              fill="none"
              stroke={LINE}
              strokeWidth={1.75}
            />
          );
        })()}

      {spec.buildOutLines ? (
        <>
          {buildOutAt(1 / 3)}
          {buildOutAt(2 / 3)}
        </>
      ) : null}

      {leftVisible ? endBox(true) : null}
      {rightVisible ? endBox(false) : null}

      {[
        cornerArc(0, 0, 1),
        cornerArc(spec.lengthYards, 0, 2),
        cornerArc(spec.lengthYards, spec.widthYards, 3),
        cornerArc(0, spec.widthYards, 4),
      ].map((d, i) =>
        d ? <path key={`corner-${i}`} d={d} fill="none" stroke={LINE} strokeWidth={1.25} /> : null
      )}
    </g>
  );
}
