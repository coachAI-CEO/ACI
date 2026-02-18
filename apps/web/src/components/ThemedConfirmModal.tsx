"use client";

type ThemedConfirmModalProps = {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ThemedConfirmModal({
  open,
  title = "Confirm Action",
  message,
  confirmLabel = "Continue",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ThemedConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-slate-900 p-5 shadow-2xl">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
          Warning
        </div>
        <h3 className="text-base font-semibold text-slate-100">{title}</h3>
        <p className="mt-2 text-sm text-slate-300">{message}</p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-slate-600/70 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full border border-amber-500/60 bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/30"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
