"use client";

import { MinusIcon, PlusIcon } from "@phosphor-icons/react";
import { useRef } from "react";

type Props = {
  value: number;
  onChange: (value: number) => void;
  label: string;
  valueText: string;
  lowerLabel: string;
  raiseLabel: string;
};

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/**
 * 0 to 100 slider (spec 6.6): role="slider", arrows step 1, PageUp/PageDown 10, Home/End,
 * aria-valuetext with the label, separate 48 px steppers. The thumb is never animated.
 */
export function ScoreSlider({ value, onChange, label, valueText, lowerLabel, raiseLabel }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const sliding = useRef(false);

  const fromX = (clientX: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r) return;
    onChange(clamp(((clientX - r.left) / r.width) * 100));
  };

  const STEP =
    "grid size-12 shrink-0 place-items-center rounded-pill border border-line bg-transparent text-[20px] text-text hover:border-text-muted active:scale-[.94]";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={lowerLabel}
        onClick={() => onChange(clamp(value - 1))}
        className={STEP}
      >
        <MinusIcon aria-hidden />
      </button>
      <div
        ref={track}
        className="relative flex h-12 flex-1 cursor-pointer items-center"
        style={{ touchAction: "none" }}
        onPointerDown={(e) => {
          sliding.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          fromX(e.clientX);
        }}
        onPointerMove={(e) => sliding.current && fromX(e.clientX)}
        onPointerUp={() => (sliding.current = false)}
        onPointerCancel={() => (sliding.current = false)}
      >
        <div className="absolute inset-x-0 h-3.5 rounded-pill border border-line-strong bg-surface-raised" />
        <div
          className="absolute left-0 h-3.5 rounded-pill bg-accent"
          style={{ width: `${value}%` }}
        />
        <div
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={value}
          aria-valuetext={valueText}
          onKeyDown={(e) => {
            const step: Record<string, number> = {
              ArrowRight: 1,
              ArrowUp: 1,
              ArrowLeft: -1,
              ArrowDown: -1,
              PageUp: 10,
              PageDown: -10,
            };
            if (e.key in step) {
              e.preventDefault();
              onChange(clamp(value + step[e.key]!));
            } else if (e.key === "Home") {
              e.preventDefault();
              onChange(0);
            } else if (e.key === "End") {
              e.preventDefault();
              onChange(100);
            }
          }}
          className="absolute -ml-4 size-8 cursor-grab rounded-pill bg-text shadow-[0_0_0_4px_var(--bg)]"
          style={{ left: `${value}%` }}
        />
      </div>
      <button
        type="button"
        aria-label={raiseLabel}
        onClick={() => onChange(clamp(value + 1))}
        className={STEP}
      >
        <PlusIcon aria-hidden />
      </button>
    </div>
  );
}
