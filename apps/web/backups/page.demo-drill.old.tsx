"use client";

import React, { useEffect, useState } from "react";

type DrillResponse = {
  ok: boolean;
  drill?: {
    json?: any;
  };
  error?: string;
};

const DEFAULT_PAYLOAD = {
  gameModelId: "POSSESSION",
  ageGroup: "U12",
  phase: "ATTACKING",
  zone: "ATTACKING_THIRD",
  numbersMin: 10,
  numbersMax: 12,
  gkOptional: true,
  goalsAvailable: 2,
  spaceConstraint: "HALF",
  durationMin: 25,
};

export default function DrillDemoPage() {
  const [data, setData] = useState<DrillResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("http://localhost:4000/coach/generate-drill-vetted", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(DEFAULT_PAYLOAD),
        });

        const json = (await res.json()) as DrillResponse;
        setData(json);
        if (!json.ok) {
          setError(json.error || "Unknown error from ACI backend.");
        }
      } catch (e: any) {
        setError(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const drill = data?.drill?.json;
  const diagram = drill?.diagramV1;
  const gameModel = drill?.gameModelId;
  const phase = drill?.phase;
  const zone = drill?.zone;

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col">
      <header className="px-8 pt-6 pb-4 border-b border-slate-800">
        <h1 className="text-2xl font-semibold tracking-tight">
          ACI Drill Diagram Demo
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Rendering <code className="text-emerald-300">diagramV1</code> from{" "}
          <code className="text-sky-300">/coach/generate-drill-vetted</code>.
        </p>
      </header>

      <main className="flex-1 px-4 sm:px-8 pb-8 flex justify-center">
        <div className="w-full max-w-5xl mt-6">
          {loading && (
            <div className="h-[500px] flex items-center justify-center rounded-2xl bg-slate-900/60 border border-slate-800">
              <p className="text-sm text-slate-400">
                Generating drill and diagram from ACI backend…
              </p>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-2xl border border-red-500/60 bg-red-950/40 px-4 py-3 text-sm">
              <p className="font-medium text-red-100">Error</p>
              <p className="mt-1 text-red-200">{error}</p>
            </div>
          )}

          {!loading && !error && drill && (
            <div className="rounded-2xl bg-slate-950/70 border border-slate-800 shadow-xl overflow-hidden">
              {/* Top bar */}
              <div className="px-6 pt-5 pb-3 border-b border-slate-800">
                <p className="text-xs font-semibold text-emerald-400 uppercase tracking-[0.18em]">
                  Tactical Diagram
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  {drill.title || "Unnamed Drill"}
                </h2>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {gameModel && (
                    <Tag active label={gameModel} />
                  )}
                  {phase && <Tag label={phase} />}
                  {zone && <Tag label={zone} />}
                </div>
              </div>

              {/* Pitch + legend */}
              <div className="px-6 py-6">
                <div className="w-full bg-slate-900 rounded-2xl border border-slate-800 flex justify-center items-center py-4">
                  {diagram ? (
                    <PitchDiagram diagram={diagram} />
                  ) : (
                    <p className="text-sm text-slate-400">
                      No diagramV1 found on this drill.
                    </p>
                  )}
                </div>

                <Legend />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Tag({ label, active }: { label: string; active?: boolean }) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium border " +
        (active
          ? "border-emerald-400/80 bg-emerald-500/10 text-emerald-200"
          : "border-slate-700 bg-slate-900/70 text-slate-300")
      }
    >
      {active && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" />
      )}
      {label}
    </span>
  );
}

function Legend() {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-slate-300">
      <LegendItem label="Attack" className="bg-sky-400" />
      <LegendItem label="Defend" className="bg-rose-400" />
      <LegendItem label="GK / Neutral" className="bg-amber-300" />
      <LegendItem label="Pass" className="border-t border-slate-100 w-6" />
      <LegendItem
        label="Run"
        className="border-t border-slate-100 border-dashed w-6"
      />
      <LegendItem
        label="Press / trigger"
        className="border-t border-orange-300 w-6"
      />
      <LegendItem
        label="Mini-goal"
        className="w-5 h-[6px] border border-cyan-300 rounded-sm"
      />
      <LegendItem
        label="Big goal"
        className="w-8 h-[8px] border-2 border-yellow-300 rounded-[3px]"
      />
      <p className="text-[10px] text-slate-500 mt-1 w-full">
        Player numbers reflect roles (e.g. 4/5 = CB, 6 = DM, 10 = AM, 7 = W).
        Lane shading shows wide channels, half-spaces and central channel.
      </p>
    </div>
  );
}

function LegendItem({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={className} />
      <span>{label}</span>
    </span>
  );
}

function PitchDiagram({ diagram }: { diagram: any }) {
  const pitch = diagram.pitch || {};
  const showZones = pitch.showZones !== false;
  const zones = pitch.zones || {};

  const players: any[] = Array.isArray(diagram.players) ? diagram.players : [];
  const arrows: any[] = Array.isArray(diagram.arrows) ? diagram.arrows : [];
  const goals: any[] = Array.isArray(diagram.goals) ? diagram.goals : [];
  const coach = diagram.coach || null;

  return (
    <svg
      viewBox="0 0 100 100"
      className="w-full max-w-[640px] aspect-[4/3] rounded-xl"
    >
      {/* Pitch background */}
      <defs>
        <linearGradient id="pitchGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#053" />
          <stop offset="100%" stopColor="#021" />
        </linearGradient>
      </defs>
      <rect
        x={5}
        y={5}
        width={90}
        height={90}
        rx={4}
        fill="url(#pitchGradient)"
        stroke="#0f172a"
        strokeWidth={0.7}
      />

      {/* Zones (wide / half-spaces / central) */}
      {showZones && (
        <>
          {/* Vertical lanes */}
          {["leftWide", "leftHalfSpace", "centralChannel", "rightHalfSpace", "rightWide"].map(
            (key, idx) => {
              if (!zones[key]) return null;
              const laneWidth = 90 / 5;
              const x = 5 + laneWidth * idx;
              return (
                <rect
                  key={key}
                  x={x}
                  y={5}
                  width={laneWidth}
                  height={90}
                  fill="rgba(15,118,110,0.18)"
                />
              );
            }
          )}
          {/* Halfway line */}
          <line
            x1={5}
            y1={50}
            x2={95}
            y2={50}
            stroke="#0f766e"
            strokeWidth={0.4}
            strokeDasharray="2 3"
          />
        </>
      )}

      {/* Goals (big + mini) */}
      {goals.map((g: any) => {
        const width = g.width || (g.type === "BIG" ? 12 : 6);
        const height = g.type === "BIG" ? 5 : 3;
        const x = (g.x ?? 50) - width / 2;
        const y = (g.y ?? 10) - height / 2;
        const stroke =
          g.type === "BIG"
            ? "#facc15"
            : g.teamAttacks === "DEF"
            ? "#22d3ee"
            : "#e5e7eb";
        const strokeWidth = g.type === "BIG" ? 1.2 : 0.6;
        const fill = "rgba(15,23,42,0.7)";

        return (
          <rect
            key={g.id || `${g.type}-${g.x}-${g.y}`}
            x={x}
            y={y}
            width={width}
            height={height}
            rx={0.8}
            ry={0.8}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );
      })}

      {/* Arrows first (under player circles) */}
      {arrows.map((a: any, idx: number) => {
        const from = findPointForArrow(a.from, players);
        const to = findPointForArrow(a.to, players);

        if (!from || !to) return null;

        const color =
          a.type === "pass"
            ? "#e5e7eb"
            : a.type === "run"
            ? "#e5e7eb"
            : a.type === "press"
            ? "#fb923c"
            : "#e5e7eb";

        const dash =
          a.style === "dotted"
            ? "1 3"
            : a.style === "dashed"
            ? "4 4"
            : undefined;

        const width = a.weight === "bold" ? 1 : 0.7;

        return (
          <g key={idx}>
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={color}
              strokeWidth={width}
              strokeDasharray={dash}
              strokeLinecap="round"
            />
            {/* simple arrow head */}
            <circle cx={to.x} cy={to.y} r={0.7} fill={color} />
          </g>
        );
      })}

      {/* Players */}
      {players.map((p: any) => {
        const color =
          p.team === "ATT"
            ? "#38bdf8"
            : p.team === "DEF"
            ? "#fb7185"
            : "#facc15";

        const x = p.x ?? 50;
        const y = p.y ?? 50;

        return (
          <g key={p.id} transform={`translate(${x},${y})`}>
            <circle r={4.2} fill="#020617" />
            <circle r={3.4} fill={color} stroke="#0f172a" strokeWidth={0.6} />
            <text
              y={1.1}
              textAnchor="middle"
              fontSize="3"
              fontWeight="600"
              fill="#0f172a"
            >
              {p.number ?? ""}
            </text>
            {p.role && (
              <text
                y={7}
                textAnchor="middle"
                fontSize="2.4"
                fill="#e5e7eb"
              >
                {p.role}
              </text>
            )}
          </g>
        );
      })}

      {/* Coach */}
      {coach && (
        <g transform={`translate(${coach.x ?? 12},${coach.y ?? 88})`}>
          <rect
            x={-3}
            y={-3}
            width={6}
            height={6}
            rx={1.5}
            fill="#f97316"
            stroke="#0f172a"
            strokeWidth={0.6}
          />
          <text
            y={7}
            textAnchor="middle"
            fontSize="2.4"
            fill="#e5e7eb"
          >
            Coach
          </text>
        </g>
      )}
    </svg>
  );
}

function findPointForArrow(endpoint: any, players: any[]) {
  if (!endpoint) return null;
  if (endpoint.playerId) {
    const p = players.find((pl) => pl.id === endpoint.playerId);
    if (!p) return null;
    return { x: p.x ?? 50, y: p.y ?? 50 };
  }
  if (typeof endpoint.x === "number" && typeof endpoint.y === "number") {
    return { x: endpoint.x, y: endpoint.y };
  }
  return null;
}
