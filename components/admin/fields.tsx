"use client";

import { CaretDownIcon, WarningCircleIcon } from "@phosphor-icons/react";
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
