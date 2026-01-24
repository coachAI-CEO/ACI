"use client";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "danger" | "warning" | "info";
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  variant = "danger",
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      confirm: "bg-red-600 hover:bg-red-500 text-white",
      icon: "⚠️",
      border: "border-red-500/50",
    },
    warning: {
      confirm: "bg-amber-600 hover:bg-amber-500 text-white",
      icon: "⚠️",
      border: "border-amber-500/50",
    },
    info: {
      confirm: "bg-blue-600 hover:bg-blue-500 text-white",
      icon: "ℹ️",
      border: "border-blue-500/50",
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        className="relative max-w-md w-full rounded-2xl border border-slate-700/70 bg-slate-900/95 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 mb-4">
          <div className="text-3xl">{styles.icon}</div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-100 mb-2">{title}</h2>
            <p className="text-sm text-slate-300">{message}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-slate-700/50">
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${styles.confirm}`}
          >
            {confirmText}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-600/70 bg-slate-800/60 text-slate-200 hover:bg-slate-700 transition-colors"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}
