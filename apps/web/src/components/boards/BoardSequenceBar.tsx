"use client";

import * as React from "react";
import {
  BOARD_SEQUENCE_DEFAULT_DURATION_MS,
  BOARD_SEQUENCE_MAX_FRAMES,
  getSequenceSummary,
} from "@/lib/board-sequence";
import type { DiagramV1 } from "@/types/diagram";

const DURATION_PRESETS = [800, 1600, 2400, 3200];

type Props = {
  diagram: DiagramV1;
  canEdit: boolean;
  playing: boolean;
  compact?: boolean;
  onPlayToggle: () => void;
  onSelectFrame: (frameId: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDurationChange?: (durationMs: number) => void;
  hidePlay?: boolean;
};

function frameLabel(index: number, title?: string) {
  const cleaned = String(title || "")
    .replace(/^(\d+\.\s*)+/, "")
    .trim();
  return cleaned || `Frame ${index + 1}`;
}

function formatDuration(ms?: number) {
  const n = ms ?? BOARD_SEQUENCE_DEFAULT_DURATION_MS;
  const s = n / 1000;
  return Number.isInteger(s) ? `${s}s` : `${s.toFixed(1)}s`;
}

/** Horizontal filmstrip under the pitch — titles stay readable until thumbs exist. */
export default function BoardSequenceBar({
  diagram,
  canEdit,
  playing,
  compact,
  onPlayToggle,
  onSelectFrame,
  onDuplicate,
  onDelete,
  onDurationChange,
  hidePlay,
}: Props) {
  const summary = getSequenceSummary(diagram);
  const atMax = summary.frameCount >= BOARD_SEQUENCE_MAX_FRAMES;
  const active = summary.frames[summary.activeIndex];
  const duration = active?.durationMs ?? BOARD_SEQUENCE_DEFAULT_DURATION_MS;

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-white/10 bg-[#07111f]/90 px-2 py-2">
      <div className="flex items-center gap-2">
        {hidePlay ? null : (
          <button
            type="button"
            onClick={onPlayToggle}
            disabled={summary.frameCount < 2}
            className="hidden h-9 min-w-[2.75rem] shrink-0 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 text-[12px] font-semibold text-emerald-100 disabled:opacity-40 lg:flex"
            title={summary.frameCount < 2 ? "Add another frame to play" : playing ? "Pause" : "Play"}
          >
            {playing ? "Pause" : "Play"}
          </button>
        )}
        <span className="min-w-0 flex-1 text-[11px] text-slate-500">Slides</span>
        {canEdit && onDurationChange ? (
          <div className="hidden items-center gap-1 sm:flex">
            {DURATION_PRESETS.map((ms) => (
              <button
                key={ms}
                type="button"
                disabled={playing}
                onClick={() => onDurationChange(ms)}
                className={`h-7 rounded-md border px-1.5 text-[10px] tabular-nums ${
                  duration === ms
                    ? "border-sky-400/50 bg-sky-500/20 text-sky-100"
                    : "border-white/10 bg-black/30 text-slate-400 hover:bg-white/5"
                }`}
                title="Hold time for this slide"
              >
                {formatDuration(ms)}
              </button>
            ))}
          </div>
        ) : null}
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

      <div className={`flex gap-1 overflow-x-auto ${compact ? "pb-0.5" : "pb-1"}`}>
        {summary.frames.map((frame, i) => {
          const isActive = frame.id === diagram.sequence?.activeFrameId;
          return (
            <button
              key={frame.id}
              type="button"
              onClick={() => onSelectFrame(frame.id)}
              className={`flex min-h-9 min-w-[7.5rem] shrink-0 items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition ${
                isActive
                  ? "border-sky-400/50 bg-sky-500/20 text-sky-50"
                  : "border-white/10 bg-black/25 text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="w-4 shrink-0 pt-px text-[11px] font-semibold tabular-nums text-slate-500">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium leading-snug">
                  {frameLabel(i, frame.title)}
                </span>
                {frame.note ? (
                  <span className="mt-0.5 block truncate text-[10px] text-slate-500">{frame.note}</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
