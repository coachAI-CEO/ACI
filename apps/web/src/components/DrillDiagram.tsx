"use client";

import React from "react";
import type { DiagramV1, DiagramPlayer, DiagramArrow } from "@/types/diagram";

type Props = {
  diagram: DiagramV1;
  width?: number;
  height?: number;
};

const teamColor = (team: DiagramPlayer["team"]): string => {
  switch (team) {
    case "ATT":
      return "#2563eb"; // blue
    case "DEF":
      return "#ef4444"; // red
    case "NEUTRAL":
    default:
      return "#6b7280"; // gray
  }
};

const arrowStrokeDash = (style: DiagramArrow["style"]): string | undefined => {
  if (style === "dashed") return "4 4";
  if (style === "dotted") return "1 4";
  return undefined;
};

const arrowColor = (type: DiagramArrow["type"]): string => {
  switch (type) {
    case "pass":
      return "#e5e7eb"; // light
    case "run":
      return "#22c55e"; // greenish
    case "press":
      return "#f97316"; // orange
    case "cover":
    case "transition":
    default:
      return "#a5b4fc"; // soft indigo
  }
};

const pitchBackground = "#022c22";
const laneTint = "#064e3b";
const pitchLineColor = "#e5e7eb";

function polarToCartesian(
  x: number,
  y: number,
  angleDeg: number,
  distance: number
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  // SVG y axis goes down, so invert sin
  return {
    x: x + distance * Math.cos(rad),
    y: y - distance * Math.sin(rad),
  };
}

export const DrillDiagram: React.FC<Props> = ({
  diagram,
  width = 520,
  height = 340,
}) => {
  const { pitch, players, coach, arrows } = diagram;

  const playerMap = new Map<string, DiagramPlayer>();
  players.forEach((p) => playerMap.set(p.id, p));

  const getPointCoords = (ref: { playerId?: string; x?: number; y?: number }) => {
    if (ref.playerId && playerMap.has(ref.playerId)) {
      const p = playerMap.get(ref.playerId)!;
      return { x: p.x, y: p.y };
    }
    if (typeof ref.x === "number" && typeof ref.y === "number") {
      return { x: ref.x, y: ref.y };
    }
    return null;
  };

  // 5 vertical lanes for HALF pitch (0–100)
  const laneWidth = 20;

  return (
    <div className="w-full flex flex-col items-center gap-2">
      <svg
        viewBox="0 0 100 100"
        width={width}
        height={height}
        className="rounded-2xl shadow-lg border border-emerald-900/60 bg-emerald-950"
      >
        <defs>
          <marker
            id="arrow-head"
            markerWidth="4"
            markerHeight="4"
            refX="3"
            refY="2"
            orient="auto"
          >
            <path d="M0,0 L4,2 L0,4 z" fill="#e5e7eb" />
          </marker>
        </defs>

        {/* Pitch background */}
        <rect
          x={0}
          y={0}
          width={100}
          height={100}
          fill={pitchBackground}
          rx={3}
          ry={3}
        />

        {/* Lane fills */}
        {pitch.showZones && pitch.zones && (
          <>
            {pitch.zones.leftWide && (
              <rect
                x={0}
                y={5}
                width={laneWidth}
                height={90}
                fill={laneTint}
                opacity={0.3}
              />
            )}
            {pitch.zones.leftHalfSpace && (
              <rect
                x={laneWidth}
                y={5}
                width={laneWidth}
                height={90}
                fill={laneTint}
                opacity={0.2}
              />
            )}
            {pitch.zones.centralChannel && (
              <rect
                x={laneWidth * 2}
                y={5}
                width={laneWidth}
                height={90}
                fill={laneTint}
                opacity={0.15}
              />
            )}
            {pitch.zones.rightHalfSpace && (
              <rect
                x={laneWidth * 3}
                y={5}
                width={laneWidth}
                height={90}
                fill={laneTint}
                opacity={0.2}
              />
            )}
            {pitch.zones.rightWide && (
              <rect
                x={laneWidth * 4}
                y={5}
                width={laneWidth}
                height={90}
                fill={laneTint}
                opacity={0.3}
              />
            )}
          </>
        )}

        {/* Vertical lane lines */}
        {pitch.showZones &&
          [laneWidth, laneWidth * 2, laneWidth * 3, laneWidth * 4].map(
            (x, idx) => (
              <line
                key={`lane-line-${idx}`}
                x1={x}
                y1={5}
                x2={x}
                y2={95}
                stroke={pitchLineColor}
                strokeWidth={0.25}
                strokeDasharray="2 4"
                opacity={0.4}
              />
            )
          )}

        {/* Outer pitch border */}
        <rect
          x={2}
          y={5}
          width={96}
          height={90}
          fill="none"
          stroke={pitchLineColor}
          strokeWidth={0.9}
        />

        {/* Halfway line */}
        <line
          x1={2}
          y1={50}
          x2={98}
          y2={50}
          stroke={pitchLineColor}
          strokeWidth={0.5}
          opacity={0.7}
        />

        {/* Penalty box + goal at top */}
        <rect
          x={30}
          y={5}
          width={40}
          height={18}
          fill="none"
          stroke={pitchLineColor}
          strokeWidth={0.75}
        />
        <rect
          x={40}
          y={5}
          width={20}
          height={7}
          fill="none"
          stroke={pitchLineColor}
          strokeWidth={0.65}
        />
        <line
          x1={45}
          y1={5}
          x2={55}
          y2={5}
          stroke={pitchLineColor}
          strokeWidth={1.2}
        />

        {/* Center circle arc */}
        <path
          d={`
            M 50 50
            m -9 0
            a 9 9 0 0 0 18 0
          `}
          fill="none"
          stroke={pitchLineColor}
          strokeWidth={0.5}
          opacity={0.6}
        />

        {/* Arrows */}
        {arrows.map((a, idx) => {
          const from = getPointCoords(a.from);
          const to = getPointCoords(a.to);
          if (!from || !to) return null;

          const dash = arrowStrokeDash(a.style);
          const col = arrowColor(a.type);
          const width = a.weight === "bold" ? 1.5 : 1;

          return (
            <line
              key={`arrow-${idx}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={col}
              strokeWidth={width}
              strokeDasharray={dash}
              markerEnd="url(#arrow-head)"
            />
          );
        })}

        {/* Players */}
        {players.map((p) => {
          const radius = 3.4;
          const col = teamColor(p.team);
          const num = p.number ?? 0;

          const nose =
            typeof p.facingAngle === "number"
              ? polarToCartesian(p.x, p.y, p.facingAngle, radius + 2)
              : null;

          return (
            <g key={p.id}>
              <circle
                cx={p.x}
                cy={p.y}
                r={radius}
                fill={col}
                stroke="#e5e7eb"
                strokeWidth={0.7}
              />
              <text
                x={p.x}
                y={p.y + 1}
                textAnchor="middle"
                fontSize={3}
                fill="#f9fafb"
                fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
                fontWeight={600}
              >
                {num}
              </text>
              {p.role && (
                <text
                  x={p.x}
                  y={p.y + radius + 3.5}
                  textAnchor="middle"
                  fontSize={2.3}
                  fill="#e5e7eb"
                  opacity={0.9}
                  fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
                >
                  {p.role}
                </text>
              )}
              {nose && (
                <line
                  x1={p.x}
                  y1={p.y}
                  x2={nose.x}
                  y2={nose.y}
                  stroke="#facc15"
                  strokeWidth={0.7}
                />
              )}
            </g>
          );
        })}

        {/* Coach */}
        {coach && (
          <g>
            <rect
              x={coach.x - 2.8}
              y={coach.y - 2.8}
              width={5.6}
              height={5.6}
              rx={1}
              ry={1}
              fill="#f97316"
              stroke="#fed7aa"
              strokeWidth={0.4}
            />
            <text
              x={coach.x}
              y={coach.y - 4.5}
              textAnchor="middle"
              fontSize={2.4}
              fill="#f9fafb"
              fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
            >
              {coach.label ?? "Coach"}
            </text>
          </g>
        )}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-3 text-[11px] text-slate-300">
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-sm bg-blue-500 border border-slate-200/40" />
          <span>Attack</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-sm bg-red-500 border border-slate-200/40" />
          <span>Defend</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-px w-5 bg-slate-100" />
          <span>Pass</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-px w-5 border-t border-dashed border-green-400" />
          <span>Run</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-px w-5 border-t border-dotted border-orange-400" />
          <span>Press / trigger</span>
        </div>
      </div>
    </div>
  );
};

export default DrillDiagram;
