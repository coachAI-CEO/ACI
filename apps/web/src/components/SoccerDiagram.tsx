import React from "react";

type DiagramPitch = {
  variant: "HALF" | "FULL";
  orientation: "HORIZONTAL" | "VERTICAL";
  showZones?: boolean;
  zones?: {
    leftWide?: boolean;
    leftHalfSpace?: boolean;
    centralChannel?: boolean;
    rightHalfSpace?: boolean;
    rightWide?: boolean;
  };
};

type DiagramPlayer = {
  id: string;
  number?: number;
  team?: "ATT" | "DEF" | "NEUTRAL";
  role?: string;
  x: number;
  y: number;
  relativePosition?: string;
  facingAngle?: number;
  labelStyle?: "number" | "number-and-role";
};

type DiagramArrow = {
  from: { playerId?: string };
  to: { playerId?: string };
  type: "pass" | "run" | "press" | "cover" | "transition";
  style: "solid" | "dashed" | "dotted";
  weight: "normal" | "bold";
};

type DiagramGoal = {
  id: string;
  type: "BIG" | "MINI";
  width: number;
  x: number; // 0–100
  y: number; // 0–100
  facingAngle?: number;
  teamAttacks?: "ATT" | "DEF" | "NEUTRAL";
};

export type DiagramV1 = {
  pitch: DiagramPitch;
  players: DiagramPlayer[];
  arrows?: DiagramArrow[];
  goals?: DiagramGoal[];
  coach?: { x: number; y: number; label?: string; note?: string };
  balls?: any[];
  cones?: any[];
  areas?: any[];
  labels?: any[];
};

const FIELD_WIDTH = 800;
const FIELD_HEIGHT = 500;

function normX(x: number): number {
  return (x / 100) * FIELD_WIDTH;
}

function normY(y: number): number {
  // legacy coordinates: 0 at bottom, 100 at top
  return ((100 - y) / 100) * FIELD_HEIGHT;
}

function teamColor(team?: "ATT" | "DEF" | "NEUTRAL"): string {
  switch (team) {
    case "ATT":
      return "#1e3a8a"; // blue-ish
    case "DEF":
      return "#b91c1c"; // red-ish
    default:
      return "#374151"; // gray
  }
}

function arrowStrokeStyle(style: DiagramArrow["style"]): string {
  if (style === "dotted") return "4,4";
  if (style === "dashed") return "8,6";
  return "0";
}

function arrowStrokeWidth(weight: DiagramArrow["weight"]): number {
  return weight === "bold" ? 3 : 2;
}

type Props = {
  diagram: DiagramV1;
};

const SoccerDiagram: React.FC<Props> = ({ diagram }) => {
  const { pitch, players = [], arrows = [], goals = [], coach } = diagram;

  // Helper to find player center
  const playerPos = (id?: string) => {
    if (!id) return null;
    const p = players.find((pl) => pl.id === id);
    if (!p) return null;
    return { x: normX(p.x), y: normY(p.y) };
  };

  return (
    <svg
      viewBox={`0 0 ${FIELD_WIDTH} ${FIELD_HEIGHT}`}
      width="100%"
      height="100%"
      style={{
        maxWidth: "900px",
        borderRadius: "20px",
        overflow: "hidden",
        boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
        background: "#047857", // pitch green
      }}
    >
      {/* Pitch base */}
      <rect
        x={0}
        y={0}
        width={FIELD_WIDTH}
        height={FIELD_HEIGHT}
        fill="#047857"
      />

      {/* Vertical lanes / channels if requested */}
      {pitch.showZones && pitch.zones && (
        <>
          {/* left wide */}
          {pitch.zones.leftWide && (
            <rect
              x={0}
              y={0}
              width={FIELD_WIDTH * 0.15}
              height={FIELD_HEIGHT}
              fill="rgba(255,255,255,0.03)"
            />
          )}
          {/* left half-space */}
          {pitch.zones.leftHalfSpace && (
            <rect
              x={FIELD_WIDTH * 0.15}
              y={0}
              width={FIELD_WIDTH * 0.15}
              height={FIELD_HEIGHT}
              fill="rgba(255,255,255,0.02)"
            />
          )}
          {/* central channel */}
          {pitch.zones.centralChannel && (
            <rect
              x={FIELD_WIDTH * 0.30}
              y={0}
              width={FIELD_WIDTH * 0.40}
              height={FIELD_HEIGHT}
              fill="rgba(255,255,255,0.015)"
            />
          )}
          {/* right half-space */}
          {pitch.zones.rightHalfSpace && (
            <rect
              x={FIELD_WIDTH * 0.70}
              y={0}
              width={FIELD_WIDTH * 0.15}
              height={FIELD_HEIGHT}
              fill="rgba(255,255,255,0.02)"
            />
          )}
          {/* right wide */}
          {pitch.zones.rightWide && (
            <rect
              x={FIELD_WIDTH * 0.85}
              y={0}
              width={FIELD_WIDTH * 0.15}
              height={FIELD_HEIGHT}
              fill="rgba(255,255,255,0.03)"
            />
          )}
        </>
      )}

      {/* Halfway line */}
      <line
        x1={0}
        y1={FIELD_HEIGHT / 2}
        x2={FIELD_WIDTH}
        y2={FIELD_HEIGHT / 2}
        stroke="rgba(255,255,255,0.25)"
        strokeWidth={2}
      />

      {/* Center circle */}
      <circle
        cx={FIELD_WIDTH / 2}
        cy={FIELD_HEIGHT / 2}
        r={FIELD_HEIGHT * 0.12}
        stroke="rgba(255,255,255,0.25)"
        strokeWidth={2}
        fill="none"
      />

      {/* GOALS (BIG + MINI) */}
      {goals.map((g) => {
        const cx = normX(g.x);
        const cy = normY(g.y);
        const isBig = g.type === "BIG";

        const baseWidth = isBig ? 90 : 45;
        const baseHeight = isBig ? 14 : 8;

        const w = baseWidth;
        const h = baseHeight;

        const stroke = g.teamAttacks === "ATT"
          ? "#facc15"
          : g.teamAttacks === "DEF"
          ? "#22d3ee"
          : "#f9fafb";

        return (
          <g key={g.id}>
            <rect
              x={cx - w / 2}
              y={cy - h / 2}
              width={w}
              height={h}
              fill="rgba(15,23,42,0.25)"
              stroke={stroke}
              strokeWidth={2}
              rx={isBig ? 4 : 3}
            />
            {/* small indicator bar */}
            <line
              x1={cx - w / 4}
              y1={cy}
              x2={cx + w / 4}
              y2={cy}
              stroke={stroke}
              strokeWidth={isBig ? 3 : 2}
            />
          </g>
        );
      })}

      {/* ARROWS (passes, runs, etc.) */}
      {arrows.map((a, idx) => {
        const from = playerPos(a.from.playerId);
        const to = playerPos(a.to.playerId);
        if (!from || !to) return null;

        const stroke =
          a.type === "pass"
            ? "#f9fafb"
            : a.type === "run"
            ? "#fde68a"
            : "#e5e7eb";

        return (
          <line
            key={`arrow-${idx}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={stroke}
            strokeWidth={arrowStrokeWidth(a.weight)}
            strokeDasharray={arrowStrokeStyle(a.style)}
            strokeLinecap="round"
          />
        );
      })}

      {/* PLAYERS */}
      {players.map((p) => {
        const cx = normX(p.x);
        const cy = normY(p.y);
        const color = teamColor(p.team);
        return (
          <g key={p.id}>
            <circle
              cx={cx}
              cy={cy}
              r={16}
              fill={color}
              stroke="#f9fafb"
              strokeWidth={2}
            />
            {p.number != null && (
              <text
                x={cx}
                y={cy + 4}
                textAnchor="middle"
                fontSize={12}
                fill="#f9fafb"
                fontWeight="600"
              >
                {p.number}
              </text>
            )}
            {p.labelStyle === "number-and-role" && p.role && (
              <text
                x={cx}
                y={cy + 26}
                textAnchor="middle"
                fontSize={10}
                fill="#e5e7eb"
              >
                {p.role}
              </text>
            )}
          </g>
        );
      })}

      {/* COACH */}
      {coach && (
        <g>
          <circle
            cx={normX(coach.x)}
            cy={normY(coach.y)}
            r={12}
            fill="#111827"
            stroke="#facc15"
            strokeWidth={2}
          />
          <text
            x={normX(coach.x)}
            y={normY(coach.y) + 4}
            textAnchor="middle"
            fontSize={10}
            fill="#facc15"
            fontWeight="600"
          >
            C
          </text>
        </g>
      )}
    </svg>
  );
};

export default SoccerDiagram;
