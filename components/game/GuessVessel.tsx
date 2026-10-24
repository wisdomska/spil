"use client";

import { HandPointingIcon, MinusIcon, PlusIcon } from "@phosphor-icons/react";
import { useReducedMotion } from "motion/react";
import { labelStickerStyle, type LabelName } from "@/components/brand/Stickers";
import { Vessel } from "@/components/brand/Vessel";
import { labelFor } from "@/lib/game";
import { useMedia } from "@/lib/useMedia";
import { useVesselDrag } from "@/lib/useVesselDrag";
import { clampLevel, crossesTen, levelForKey } from "@/lib/vessel";

type Props = {
  /** null until the first touch: no anchor at 50 (SPIL-10). */
  value: number | null;
  onChange: (value: number) => void;
  label: string;
  valueText: (value: number, label: string) => string;
  emptyText: string;
  hint: string;
  lowerLabel: string;
  raiseLabel: string;
  lowCaption: string;
  highCaption: string;
  /** The label sticker beside the level (Spill Scores); off for percentages. */
  showLabel?: boolean;
  /** Shown after the number, like "%". */
  unit?: string;
};

/**
 * The guess input (SPIL-10): drag or tap the liquid, or use the keyboard (role="slider").
 * Before the first touch the liquid sits faint at 50 with a "Drag the liquid" hint and no value.
 */
export function GuessVessel({
  value,
  onChange,
  label,
  valueText,
  emptyText,
  hint,
  lowerLabel,
  raiseLabel,
  lowCaption,
  highCaption,
  showLabel = true,
  unit = "",
}: Props) {
  const reduced = useReducedMotion() ?? false;
  const wide = useMedia("(min-width: 640px)");
  const height = wide ? 400 : 380;
  const shown = value ?? 50;
  const sticker = labelFor(shown).name as LabelName;

  const set = (next: number) => {
    const v = clampLevel(next);
    // A small tick on Android each time the guess crosses a multiple of 10.
    if (!reduced && crossesTen(shown, v)) navigator.vibrate?.(5);
    onChange(v);
  };
  const { ref, dragging, handlers } = useVesselDrag(set);

  const STEP =
    "grid size-12 shrink-0 place-items-center rounded-pill border border-line bg-transparent text-[20px] text-text hover:border-text-muted active:scale-[.94]";

  return (
    <div className="mx-auto grid w-full max-w-[440px] gap-3">
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value ?? undefined}
        aria-valuetext={value === null ? emptyText : valueText(value, sticker)}
        className="relative rounded-card outline-offset-[3px] select-none"
        style={{ touchAction: "none", cursor: dragging ? "grabbing" : "grab" }}
        {...handlers}
        onKeyDown={(e) => {
          const next = levelForKey(e.key, shown);
          if (next === null) return;
          e.preventDefault();
          set(next);
        }}
      >
        <div style={{ opacity: value === null ? 0.4 : 1, transition: "opacity 200ms ease" }}>
          <Vessel
            level={shown}
            num={value === null ? "" : `${value}${unit}`}
            height={height}
            fontSize={120}
            radius={24}
          />
        </div>
        {value === null ? (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 animate-nudge items-center gap-1.5 rounded-pill bg-bg px-3.5 py-2.5 text-[14px] leading-none font-semibold whitespace-nowrap text-text"
          >
            <HandPointingIcon size={18} />
            {hint}
          </span>
        ) : showLabel ? (
          <span
            aria-hidden
            className="pointer-events-none absolute right-[-8px]"
            style={{
              ...labelStickerStyle(sticker, 4, 16),
              top: `${100 - shown}%`,
              transform: "translateY(-50%)",
            }}
          >
            {sticker}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={lowerLabel}
          onClick={() => set(shown - 1)}
          className={STEP}
        >
          <MinusIcon aria-hidden />
        </button>
        <div className="flex flex-1 justify-between font-mono text-[13px] leading-none font-medium whitespace-nowrap text-text-muted">
          <span>{lowCaption}</span>
          <span>{highCaption}</span>
        </div>
        <button
          type="button"
          aria-label={raiseLabel}
          onClick={() => set(shown + 1)}
          className={STEP}
        >
          <PlusIcon aria-hidden />
        </button>
      </div>
    </div>
  );
}
