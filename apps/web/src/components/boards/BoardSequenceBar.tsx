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

function frameLabel(index: number, title?: string) {
  const cleaned = String(title || "")
    .replace(/^(\d+\.\s*)+/, "")
    .trim();
  return cleaned || `Frame ${index + 1}`;
}

/** Vertical slide list under the pitch — titles stay readable. */
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
    <div className="flex flex-col gap-1.5 rounded-xl border border-white/10 bg-[#07111f]/90 px-2 py-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPlayToggle}
          disabled={summary.frameCount < 2}
          className="flex h-9 min-w-[2.75rem] shrink-0 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 text-[12px] font-semibold text-emerald-100 disabled:opacity-40"
          title={summary.frameCount < 2 ? "Add another frame to play" : playing ? "Pause" : "Play"}
        >
          {playing ? "Pause" : "Play"}
        </button>
        <span className="min-w-0 flex-1 text-[11px] text-slate-500">Slides</span>
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

      <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
        {summary.frames.map((frame, i) => {
          const active = frame.id === diagram.sequence?.activeFrameId;
          return (
            <button
              key={frame.id}
              type="button"
              onClick={() => onSelectFrame(frame.id)}
              className={`flex min-h-9 items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition ${
                active
                  ? "border-sky-400/50 bg-sky-500/20 text-sky-50"
                  : "border-white/10 bg-black/25 text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="w-4 shrink-0 pt-px text-[11px] font-semibold tabular-nums text-slate-500">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 text-[12px] font-medium leading-snug">
                {frameLabel(i, frame.title)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
