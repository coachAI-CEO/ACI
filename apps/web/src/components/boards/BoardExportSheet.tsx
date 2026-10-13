"use client";

type Props = {
  open: boolean;
  includeNote: boolean;
  onIncludeNoteChange: (next: boolean) => void;
  exporting: string | null;
  onClose: () => void;
  onPng: () => void;
  onGif: () => void;
  onCopyLink?: () => void;
  gifDisabled?: boolean;
};

export default function BoardExportSheet({
  open,
  includeNote,
  onIncludeNoteChange,
  exporting,
  onClose,
  onPng,
  onGif,
  onCopyLink,
  gifDisabled,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#060a13]/80 px-4 py-6 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#07111f] p-5 shadow-2xl">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
          Export
        </div>
        <h3 className="text-base font-semibold text-slate-100">Share this session</h3>
        <p className="mt-1.5 text-sm text-slate-400">
          PNG keeps our 7v7 / 9v9 / 11v11 markings. GIF walks every slide.
        </p>

        <label className="mt-4 flex items-center gap-2 text-[13px] text-slate-200">
          <input
            type="checkbox"
            checked={includeNote}
            onChange={(e) => onIncludeNoteChange(e.target.checked)}
            className="h-4 w-4 accent-emerald-400"
          />
          Include coaching note
        </label>

        <div className="mt-4 grid gap-2">
          <button
            type="button"
            disabled={Boolean(exporting)}
            onClick={onPng}
            className="flex h-11 items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 text-left text-sm text-slate-100 hover:bg-white/5 disabled:opacity-40"
          >
            <span>PNG this slide</span>
            <span className="text-[11px] text-slate-500">Current frame</span>
          </button>
          <button
            type="button"
            disabled={Boolean(exporting) || gifDisabled}
            onClick={onGif}
            className="flex h-11 items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 text-left text-sm font-semibold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-40"
          >
            <span>{exporting?.startsWith("Exporting GIF") ? exporting : "GIF the session"}</span>
            <span className="text-[11px] font-normal text-emerald-200/70">Play + captions</span>
          </button>
          {onCopyLink ? (
            <button
              type="button"
              disabled={Boolean(exporting)}
              onClick={onCopyLink}
              className="flex h-11 items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 text-left text-sm text-slate-100 hover:bg-white/5 disabled:opacity-40"
            >
              <span>Copy link</span>
              <span className="text-[11px] text-slate-500">Share URL</span>
            </button>
          ) : null}
        </div>

        {exporting ? (
          <p className="mt-3 text-[12px] text-emerald-200/80">{exporting}</p>
        ) : null}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/[0.08]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
