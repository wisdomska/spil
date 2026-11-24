"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { cn } from "@/lib/cn";
import type { Edition, LocalEdition } from "@/lib/game";

/**
 * Edition chips (owner request 2026-11-24): Global plus the local editions the pack has
 * questions for. Shown next to the length only when the pack has local questions; the best fit
 * is already picked, so the host can skip it. Same chip look as the length.
 */
export function EditionChips({
  available,
  value,
  onChange,
  busy,
  className,
}: {
  available: readonly LocalEdition[];
  value: Edition;
  onChange: (edition: Edition) => void;
  busy?: boolean;
  className?: string;
}) {
  const t = useTranslations("editions");
  const id = useId();
  if (available.length === 0) return null;
  const options: Edition[] = ["global", ...available];
  return (
    <div className={cn("grid gap-2", className)}>
      <span id={id} className="text-[13px] leading-none text-text-muted">
        {t("label")}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={id}
        aria-describedby={`${id}-hint`}
        className="flex flex-wrap gap-1.5"
      >
        {options.map((e) => {
          const on = e === value;
          return (
            <button
              key={e}
              type="button"
              role="radio"
              aria-checked={on}
              aria-disabled={busy || undefined}
              data-edition={e}
              onClick={() => !on && !busy && onChange(e)}
              className={cn(
                "h-11 min-w-12 rounded-pill border-[1.5px] px-3.5 text-[15px] leading-none font-semibold hover:border-text",
                on
                  ? "border-accent bg-accent-soft text-accent-ink"
                  : "border-line-strong bg-transparent text-text",
                busy && !on && "opacity-60",
              )}
            >
              {t(e)}
            </button>
          );
        })}
      </div>
      <span id={`${id}-hint`} className="sr-only">
        {t("hint")}
      </span>
    </div>
  );
}
