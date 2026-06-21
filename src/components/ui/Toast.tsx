"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type ToastVariant = "success" | "error" | "info";

type ToastState = {
  id: number;
  message: string;
  variant: ToastVariant;
  duration: number | null;
};

type ShowToastOptions = {
  duration?: number | null;
};

type ToastContextValue = {
  show: (
    message: string,
    variant?: ToastVariant,
    options?: ShowToastOptions,
  ) => void;
  success: (message: string, options?: ShowToastOptions) => void;
  error: (message: string, options?: ShowToastOptions) => void;
  info: (message: string, options?: ShowToastOptions) => void;
  dismiss: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success:
    "border-emerald-500/40 bg-[#0a0a0a]/95 text-emerald-100 shadow-[0_0_24px_rgba(16,185,129,0.12)]",
  error:
    "border-red-500/40 bg-[#0a0a0a]/95 text-red-100 shadow-[0_0_24px_rgba(239,68,68,0.12)]",
  info: "border-[#d4af37]/40 bg-[#0a0a0a]/95 text-[#f5e6b3]/90 shadow-[0_0_24px_rgba(212,175,55,0.12)]",
};

function ToastViewport({
  toast,
  onDismiss,
}: {
  toast: ToastState | null;
  onDismiss: () => void;
}) {
  if (!toast) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-[100] w-[min(92vw,28rem)] -translate-x-1/2 pointer-events-none"
    >
      <div
        className={`animate-toast-in pointer-events-auto border px-4 py-3 font-['PerfectDOS'] text-xs normal-case leading-relaxed ${VARIANT_STYLES[toast.variant]}`}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="flex-1">{toast.message}</p>
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-white/40 transition-colors hover:text-white uppercase text-[10px]"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const idRef = useRef(0);

  const dismiss = useCallback(() => {
    setToast(null);
  }, []);

  const show = useCallback(
    (
      message: string,
      variant: ToastVariant = "info",
      options?: ShowToastOptions,
    ) => {
      idRef.current += 1;
      const duration =
        options?.duration ??
        (variant === "info" ? null : variant === "error" ? 7000 : 5000);

      setToast({
        id: idRef.current,
        message,
        variant,
        duration,
      });
    },
    [],
  );

  const success = useCallback(
    (message: string, options?: ShowToastOptions) => {
      show(message, "success", options);
    },
    [show],
  );

  const error = useCallback(
    (message: string, options?: ShowToastOptions) => {
      show(message, "error", options);
    },
    [show],
  );

  const info = useCallback(
    (message: string, options?: ShowToastOptions) => {
      show(message, "info", options);
    },
    [show],
  );

  useEffect(() => {
    if (!toast || toast.duration === null) {
      return;
    }

    const timer = window.setTimeout(dismiss, toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast, dismiss]);

  return (
    <ToastContext.Provider value={{ show, success, error, info, dismiss }}>
      {children}
      <ToastViewport toast={toast} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
