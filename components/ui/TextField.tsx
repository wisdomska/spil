import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

type FieldProps = {
  id: string;
  label: React.ReactNode;
  help?: React.ReactNode;
  error?: React.ReactNode;
  multiline?: boolean;
  rows?: number;
} & Omit<React.InputHTMLAttributes<HTMLInputElement & HTMLTextAreaElement>, "id">;

const BASE =
  "w-full rounded-input border-[1.5px] bg-surface px-4 text-[17px] text-text focus-visible:outline-none focus:shadow-[0_0_0_3px_var(--accent-soft)]";

/** Label above, helper or error below (error carries an icon). Edge uses --line-strong (HANDOFF rule 3). */
export const TextField = forwardRef<HTMLInputElement & HTMLTextAreaElement, FieldProps>(
  function TextField({ id, label, help, error, multiline, rows = 5, className, ...rest }, ref) {
    const msgId = `${id}-msg`;
    const invalid = Boolean(error);
    return (
      <div className="grid gap-2">
        <label htmlFor={id} className="text-[14px] leading-none font-semibold">
          {label}
        </label>
        {multiline ? (
          <textarea
            ref={ref}
            id={id}
            rows={rows}
            aria-invalid={invalid || undefined}
            aria-describedby={help || error ? msgId : undefined}
            className={cn(
              BASE,
              "resize-y py-3.5 leading-[1.5]",
              invalid ? "border-error" : "border-line-strong focus:border-accent",
              className,
            )}
            {...rest}
          />
        ) : (
          <input
            ref={ref}
            id={id}
            aria-invalid={invalid || undefined}
            aria-describedby={help || error ? msgId : undefined}
            className={cn(
              BASE,
              "h-14 leading-none font-medium",
              invalid ? "border-error" : "border-line-strong focus:border-accent",
              className,
            )}
            {...rest}
          />
        )}
        {(help || error) && (
          <span
            id={msgId}
            className={cn(
              "flex items-center gap-1.5 text-[14px] leading-[1.35]",
              invalid ? "text-error" : "text-text-muted",
            )}
          >
            {invalid && <WarningCircleIcon size={18} aria-hidden className="shrink-0" />}
            {error || help}
          </span>
        )}
      </div>
    );
  },
);
