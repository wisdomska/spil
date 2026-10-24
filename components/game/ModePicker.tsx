"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { availableModes, MODE_RULES, type Mode } from "@/lib/game";

type Props = {
  value: Mode;
  onChange: (mode: Mode) => void;
  /** The host's age floor: adult-only modes need 18. */
  floor: number;
};

/** Pick the game before the pack (Batch 1). Only modes that are built show up. */
export function ModePicker({ value, onChange, floor }: Props) {
  const t = useTranslations("modes");
  const modes = availableModes(floor);
  if (modes.length < 2) return null;
  return (
    <div role="radiogroup" aria-label={t("group")} className="grid gap-2.5 sm:grid-cols-2">
      {modes.map((m) => {
        const on = m === value;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(m)}
            className={cn(
              "grid gap-1.5 rounded-card border-[1.5px] p-4 text-left",
              on
                ? "border-accent bg-accent-soft text-text"
                : "border-line bg-surface text-text hover:bg-surface-raised",
            )}
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="font-display text-[20px] leading-none font-extrabold">
                {t(`${m}.name`)}
              </span>
              <span className="font-mono text-[12px] leading-none font-medium whitespace-nowrap text-text-muted">
                {t("min", { n: MODE_RULES[m].minPlayers })}
              </span>
            </span>
            <span className="text-[14px] leading-[1.4] text-text-muted">{t(`${m}.body`)}</span>
          </button>
        );
      })}
    </div>
  );
}
