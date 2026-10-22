"use client";

import { CheckCircleIcon, InfoIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { createContext, useCallback, useContext, useRef, useState } from "react";

type Kind = "ok" | "err" | "info";
type ToastState = { id: number; message: string; kind: Kind } | null;

const ToastContext = createContext<(message: string, kind?: Kind) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const ICONS = { ok: CheckCircleIcon, err: WarningCircleIcon, info: InfoIcon } as const;
const ICON_COLOUR = { ok: "text-success", err: "text-error", info: "text-text-muted" } as const;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((message: string, kind: Kind = "ok") => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), message, kind });
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const Icon = toast ? ICONS[toast.kind] : null;

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        role="status"
        className="pointer-events-none fixed inset-x-4 bottom-[100px] flex justify-center lg:inset-x-auto lg:right-6 lg:bottom-6"
        style={{ zIndex: "var(--z-toast)" }}
      >
        {toast && Icon && (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-full animate-rise items-center gap-3 rounded-[16px] border border-line bg-surface-raised px-[18px] py-[14px] text-[15px]/[1.35] font-medium shadow-[0_18px_36px_-18px_var(--shadow)] lg:w-[380px]"
          >
            <Icon size={22} className={`shrink-0 ${ICON_COLOUR[toast.kind]}`} aria-hidden />
            {toast.message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
