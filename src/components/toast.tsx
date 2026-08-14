"use client";

import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type ToastType = "error" | "success" | "info";
type Toast = { id: number; type: ToastType; message: string };

const ToastContext = createContext<{ toast: (type: ToastType, message: string) => void } | null>(
  null
);

const ICONS: Record<ToastType, ReactNode> = {
  error: <TriangleAlert className="h-4 w-4 text-[#b3261e]" aria-hidden="true" />,
  success: <CheckCircle2 className="h-4 w-4 text-[#1f5b1f]" aria-hidden="true" />,
  info: <Info className="h-4 w-4 text-[#3b6486]" aria-hidden="true" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, message: string) => {
      const id = ++counter.current;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="pointer-events-none fixed bottom-6 right-6 z-[60] flex w-80 flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto card flex items-start gap-3 px-4 py-3 shadow-lg"
          >
            <span className="mt-0.5 shrink-0">{ICONS[t.type]}</span>
            <p className="min-w-0 flex-1 text-[0.875rem] leading-snug text-onsurface">
              {t.message}
            </p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 cursor-pointer rounded p-0.5 text-secondary transition-colors hover:text-onsurface"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx.toast;
}