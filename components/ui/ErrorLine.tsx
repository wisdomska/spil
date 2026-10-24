import { WarningCircleIcon } from "@phosphor-icons/react";

/** Inline error under a button: alert icon and message, announced to screen readers (SPIL-05). */
export function InlineError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="m-0 mt-2 flex items-start gap-1.5 text-[14px] leading-[1.4] text-error"
    >
      <WarningCircleIcon size={18} aria-hidden className="mt-px shrink-0" />
      {children}
    </p>
  );
}
