"use client";

import * as React from "react";
import {
  BOARD_SEQUENCE_MAX_FRAMES,
  getSequenceSummary,
} from "@/lib/board-sequence";
import type { DiagramV1 } from "@/types/diagram";

type Props = {
  diagram: DiagramV1;
  canEdit: boolean;
  playing: boolean;
  onPlayToggle: () => void;
  onSelectFrame: (frameId: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

/** Compact filmstrip under the pitch (Idea A). */
export default function BoardSequenceBar({
  diagram,
  canEdit,
  playing,
  onPlayToggle,
  onSelectFrame,
  onDuplicate,
  onDelete,
}: Props) {
  const summary = getSequenceSummary(diagram);
  const atMax = summary.frameCount >= BOARD_SEQUENCE_MAX_FRAMES;

  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#07111f]/90 px-2 py-1.5">
      <button
        type="button"
        onClick={onPlayToggle}
        disabled={summary.frameCount < 2}
        className="flex h-9 min-w-[2.75rem] shrink-0 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 text-[12px] font-semibold text-emerald-100 disabled:opacity-40"
        title={summary.frameCount < 2 ? "Add another frame to play" : playing ? "Pause" : "Play"}
      >
        {playing ? "Pause" : "Play"}
      </button>

      <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
        {summary.frames.map((frame, i) => {
          const active = frame.id === diagram.sequence?.activeFrameId;
          return (
            <button
              key={frame.id}
              type="button"
              onClick={() => onSelectFrame(frame.id)}
              className={`flex h-9 min-w-[4.75rem] shrink-0 flex-col justify-center rounded-lg border px-2 text-left transition ${
                active
                  ? "border-sky-400/50 bg-sky-500/20 text-sky-50"
                  : "border-white/10 bg-black/25 text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="truncate text-[11px] font-medium leading-tight">
                {i + 1}. {frame.title?.trim() || `Frame ${i + 1}`}
              </span>
            </button>
          );
        })}
      </div>

      {canEdit ? (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onDuplicate}
            disabled={atMax || playing}
            className="flex h-9 items-center rounded-lg border border-white/10 bg-black/30 px-2.5 text-[11px] text-slate-200 hover:bg-white/5 disabled:opacity-40"
            title={atMax ? `Max ${BOARD_SEQUENCE_MAX_FRAMES} frames` : "Duplicate current frame"}
          >
            +
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={summary.frameCount <= 1 || playing}
            className="flex h-9 items-center rounded-lg border border-white/10 bg-black/30 px-2.5 text-[11px] text-slate-300 hover:bg-white/5 disabled:opacity-40"
            title="Delete current frame"
          >
            −
          </button>
        </div>
      ) : null}

      <span className="shrink-0 text-[10px] tabular-nums text-slate-500">
        {summary.activeIndex + 1}/{summary.frameCount}
      </span>
    </div>
  );
}
