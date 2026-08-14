"use client";

type ThemedConfirmModalProps = {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "warning" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ThemedConfirmModal({
  open,
  title = "Confirm Action",
  message,
  confirmLabel = "Continue",
  cancelLabel = "Cancel",
  tone = "warning",
  onConfirm,
  onCancel,
}: ThemedConfirmModalProps) {
  if (!open) return null;

  const danger = tone === "danger";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#060a13]/80 px-4 backdrop-blur-sm">
      <div
        className={`w-full max-w-md rounded-2xl border p-5 shadow-2xl ${
          danger
            ? "border-rose-500/40 bg-[#07111f]"
            : "border-amber-500/40 bg-[#07111f]"
        }`}
      >
        <div
          className={`mb-2 text-xs font-semibold uppercase tracking-[0.16em] ${
            danger ? "text-rose-300" : "text-amber-300"
          }`}
        >
          {danger ? "Delete" : "Warning"}
        </div>
        <h3 className="text-base font-semibold text-slate-100">{title}</h3>
        <p className="mt-2 text-sm text-slate-300">{message}</p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/[0.08]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${
              danger
                ? "border-rose-500/60 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30"
                : "border-amber-500/60 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
