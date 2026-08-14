"use client";

import { Loader2 } from "lucide-react";
import { useEffect, type ReactNode } from "react";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
  icon,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  icon?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="card w-full max-w-sm px-6 py-6"
        onClick={(e) => e.stopPropagation()}
      >
        {icon ? (
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-tertiary">
            {icon}
          </div>
        ) : null}
        <h2 className="text-lg font-semibold text-onsurface">{title}</h2>
        <div className="mt-1 text-[0.875rem] leading-relaxed text-secondary">
          {message}
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            className="btn btn-text"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
