import { forwardRef } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "quiet" | "destructive";
type Size = "lg" | "md";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner before the label and blocks presses. */
  loading?: boolean;
  /** Renders as unavailable but still focusable and clickable, so it can explain why (aria-disabled). */
  softDisabled?: boolean;
  block?: boolean;
};

const VARIANTS: Record<Variant, string> = {
  primary: "border-0 bg-accent text-on-accent hover:shadow-[inset_0_0_0_99px_var(--press-glow)]",
  secondary: "border-[1.5px] border-text bg-transparent text-text hover:bg-surface-raised",
  ghost: "border-0 bg-transparent text-text hover:bg-surface-raised",
  quiet: "border-0 bg-transparent text-text-muted hover:bg-surface-raised hover:text-text",
  destructive: "border-0 bg-error text-bg hover:brightness-[1.08]",
};

const OFF = "border-0 bg-surface-raised text-text-muted shadow-none hover:shadow-none";

const SIZES: Record<Size, string> = {
  lg: "h-14 px-6 text-[17px]",
  md: "h-12 px-4 text-[15px]",
};

/** Pill button. Labels never wrap; press scales to .97 (HANDOFF "press"). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "lg",
    loading,
    softDisabled,
    block,
    className,
    children,
    onClick,
    type = "button",
    ...rest
  },
  ref,
) {
  const off = softDisabled || loading;
  return (
    <button
      ref={ref}
      type={type}
      aria-disabled={off || undefined}
      aria-busy={loading || undefined}
      onClick={(event) => {
        if (loading) return event.preventDefault();
        onClick?.(event);
      }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-pill leading-none font-semibold whitespace-nowrap select-none",
        "not-aria-disabled:active:scale-[.97]",
        SIZES[size],
        softDisabled ? OFF : VARIANTS[variant],
        block && "w-full",
        className,
      )}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
});

/**
 * Loading indicator: a ring in the current text colour with a turning arc. Sized to the text, so
 * it fits any button. With reduced motion it holds still (the button also sets aria-busy).
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      className={cn("size-[1.1em] shrink-0 motion-safe:animate-spin", className)}
    >
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="3" opacity=".25" />
      <path
        d="M21.5 12A9.5 9.5 0 0 0 12 2.5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
