"use client";

import { CaretDownIcon, MinusIcon, PlusIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

/** Admin field look (design inputStyle): 48 px, radius 14, 1.5 px strong edge, page background. */
export const FIELD =
  "box-border w-full rounded-input border-[1.5px] border-line-strong bg-bg px-3.5 text-[15px] font-medium text-text focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]";

type RowProps = {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
};

/** Label above, muted hint below (design modal field). */
export function FieldRow({ id, label, hint, children }: RowProps) {
  return (
    <div className="grid content-start gap-2">
      <label htmlFor={id} className="text-[14px] leading-none font-semibold">
        {label}
      </label>
      {children}
      {hint && (
        <span id={`${id}-hint`} className="text-[13px] leading-[1.4] text-text-muted">
          {hint}
        </span>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(FIELD, "h-12", className)} {...rest} />;
  },
);

/**
 * Whole numbers with our own minus and plus buttons instead of the browser's spinner arrows
 * (owner request). Typing still works; the buttons step by 1 within min and max.
 */
export function NumberInput({
  id,
  value,
  onValueChange,
  min,
  max,
  decreaseLabel,
  increaseLabel,
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  min: number;
  max: number;
  decreaseLabel: string;
  increaseLabel: string;
}) {
  const n = Number(value);
  const step = (by: number) => {
    const base = Number.isFinite(n) && value !== "" ? n : min;
    onValueChange(String(Math.min(max, Math.max(min, Math.round(base) + by))));
  };
  const STEP =
    "grid size-9 shrink-0 place-items-center rounded-pill border-0 bg-transparent text-[18px] text-text hover:bg-surface-raised disabled:pointer-events-none disabled:opacity-40";
  return (
    <div
      className={cn(
        FIELD,
        "flex h-12 items-center gap-1 pr-1.5 focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-soft)]",
      )}
    >
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => onValueChange(e.target.value.replace(/\D/g, ""))}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            step(1);
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            step(-1);
          }
        }}
        className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] font-medium text-text tabular-nums outline-none"
        {...rest}
      />
      <button
        type="button"
        aria-label={decreaseLabel}
        aria-controls={id}
        disabled={value !== "" && n <= min}
        onClick={() => step(-1)}
        className={STEP}
      >
        <MinusIcon aria-hidden />
      </button>
      <button
        type="button"
        aria-label={increaseLabel}
        aria-controls={id}
        disabled={value !== "" && n >= max}
        onClick={() => step(1)}
        className={STEP}
      >
        <PlusIcon aria-hidden />
      </button>
    </div>
  );
}

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea({ className, rows = 3, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(FIELD, "resize-y py-3 leading-[1.45]", className)}
      {...rest}
    />
  );
});

export function Select({
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={cn("relative block", className)}>
      <select className={cn(FIELD, "h-12 cursor-pointer appearance-none pr-10")} {...rest}>
        {children}
      </select>
      <CaretDownIcon
        aria-hidden
        size={16}
        className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-text-muted"
      />
    </span>
  );
}

/** Inline error under a form (design role="alert" line with the warning icon). */
export function ErrorLine({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <span
      role="alert"
      className="flex items-center gap-2 text-[14px] leading-[1.4] font-medium text-error"
    >
      <WarningCircleIcon aria-hidden size={18} className="shrink-0" />
      {children}
    </span>
  );
}
