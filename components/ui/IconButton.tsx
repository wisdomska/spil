import { forwardRef } from "react";
import { cn } from "@/lib/cn";

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  variant?: "outline" | "ghost";
};

/** 48 x 48 round icon button. Press scales to .92 (HANDOFF "press"). */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = "outline", className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cn(
        "grid size-12 shrink-0 place-items-center rounded-pill text-[20px] text-text active:scale-[.92]",
        variant === "outline"
          ? "border border-line bg-transparent hover:bg-surface-raised"
          : "border-0 bg-transparent text-text-muted hover:bg-surface-raised hover:text-text",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
