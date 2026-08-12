"use client";

import type { ReactNode } from "react";
import type { DiagramArrow, DiagramTeamCode } from "@/types/diagram";

export type BoardTool =
  | "select"
  | "add-player"
  | "line-pass"
  | "line-run"
  | "line-press"
  | "line-draw"
  | "shape-rect"
  | "shape-circle"
  | "label"
  | "ball"
  | "eraser";

type Props = {
  tool: BoardTool;
  onToolChange: (tool: BoardTool) => void;
  addTeam: DiagramTeamCode;
  onAddTeamChange: (team: DiagramTeamCode) => void;
  onUndo: () => void;
  disabled?: boolean;
};

const btn = (active: boolean) =>
  `min-h-10 rounded-lg border px-2.5 text-[11px] font-medium tracking-wide ${
    active
      ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-100"
      : "border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200"
  }`;

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-r border-white/10 pr-3 last:border-r-0 last:pr-0">
      <span className="mr-0.5 text-[10px] uppercase tracking-wider text-slate-500">{title}</span>
      {children}
    </div>
  );
}

export default function BoardToolbar({
  tool,
  onToolChange,
  addTeam,
  onAddTeamChange,
  onUndo,
  disabled,
}: Props) {
  if (disabled) return null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/25 p-2">
      <div className="flex flex-wrap items-center gap-3">
        <Group title="Select">
          <button type="button" className={btn(tool === "select")} onClick={() => onToolChange("select")}>
            Move
          </button>
          <button
            type="button"
            className={btn(tool === "add-player")}
            onClick={() => onToolChange("add-player")}
          >
            Player
          </button>
          {tool === "add-player" ? (
            <select
              value={addTeam}
              onChange={(e) => onAddTeamChange(e.target.value as DiagramTeamCode)}
              className="min-h-10 rounded-lg border border-white/10 bg-black/40 px-2 text-[11px] text-slate-200"
            >
              <option value="ATT">ATT</option>
              <option value="DEF">DEF</option>
              <option value="NEUTRAL">NEU</option>
            </select>
          ) : null}
          <button type="button" className={btn(tool === "ball")} onClick={() => onToolChange("ball")}>
            Ball
          </button>
        </Group>

        <Group title="Lines">
          <button
            type="button"
            className={btn(tool === "line-pass")}
            onClick={() => onToolChange("line-pass")}
            title="Pass arrow"
          >
            Pass
          </button>
          <button
            type="button"
            className={btn(tool === "line-run")}
            onClick={() => onToolChange("line-run")}
            title="Run / movement"
          >
            Run
          </button>
          <button
            type="button"
            className={btn(tool === "line-press")}
            onClick={() => onToolChange("line-press")}
            title="Press / cover"
          >
            Press
          </button>
          <button
            type="button"
            className={btn(tool === "line-draw")}
            onClick={() => onToolChange("line-draw")}
            title="Free line"
          >
            Line
          </button>
        </Group>

        <Group title="Shapes">
          <button
            type="button"
            className={btn(tool === "shape-rect")}
            onClick={() => onToolChange("shape-rect")}
          >
            Box
          </button>
          <button
            type="button"
            className={btn(tool === "shape-circle")}
            onClick={() => onToolChange("shape-circle")}
          >
            Circle
          </button>
        </Group>

        <Group title="Annotate">
          <button type="button" className={btn(tool === "label")} onClick={() => onToolChange("label")}>
            Text
          </button>
          <button type="button" className={btn(tool === "eraser")} onClick={() => onToolChange("eraser")}>
            Eraser
          </button>
          <button
            type="button"
            className={btn(false)}
            onClick={onUndo}
            title="Undo (⌘Z)"
          >
            Undo
          </button>
        </Group>
      </div>

      <p className="text-[10px] text-slate-500">
        {toolHint(tool)}
      </p>
    </div>
  );
}

function toolHint(tool: BoardTool): string {
  switch (tool) {
    case "select":
      return "Drag players or the ball to move. Click empty pitch to deselect.";
    case "add-player":
      return "Click the pitch to place a player.";
    case "ball":
      return "Click the pitch to place a ball (drag with Move).";
    case "line-pass":
    case "line-run":
    case "line-press":
    case "line-draw":
      return "Drag from pitch or a player. Drop on a player to link (sticks when they move), or anywhere for a free end.";
    case "shape-rect":
      return "Drag to draw a rectangular zone.";
    case "shape-circle":
      return "Drag to draw a circular highlight.";
    case "label":
      return "Click the pitch to add a text label.";
    case "eraser":
      return "Click a line to erase it. Also removes shapes, labels, balls, or players.";
    default:
      return "";
  }
}

export function lineToolToArrow(tool: BoardTool): {
  type: DiagramArrow["type"];
  style: DiagramArrow["style"];
  weight: DiagramArrow["weight"];
} | null {
  if (tool === "line-pass") return { type: "pass", style: "solid", weight: "normal" };
  if (tool === "line-run") return { type: "run", style: "dashed", weight: "normal" };
  if (tool === "line-press") return { type: "press", style: "solid", weight: "bold" };
  if (tool === "line-draw") return { type: "transition", style: "solid", weight: "normal" };
  return null;
}
