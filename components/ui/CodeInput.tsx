"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Uppercases, strips spaces, dashes and anything outside A to Z / 0 to 9, keeps 4 characters. */
export function cleanCode(raw: string) {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
}

type CodeInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  invalid?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
};

/** One real input laid over four visual boxes (HANDOFF rule 13). */
export function CodeInput({
  id,
  value,
  onChange,
  onSubmit,
  invalid,
  describedBy,
  autoFocus,
}: CodeInputProps) {
  const [focused, setFocused] = useState(false);
  const active = Math.min(value.length, 3);
  return (
    <div className="relative grid grid-cols-4 gap-2.5">
      {[0, 1, 2, 3].map((i) => {
        const isActive = focused && i === active;
        return (
          <div
            key={i}
            aria-hidden
            className={cn(
              "grid h-[76px] place-items-center rounded-input border-[1.5px] bg-surface font-mono text-[36px] leading-none font-semibold text-text",
              invalid ? "border-error" : isActive ? "border-accent" : "border-line-strong",
            )}
            style={{ boxShadow: isActive && !invalid ? "0 0 0 3px var(--accent-soft)" : "none" }}
          >
            {value[i] ?? ""}
          </div>
        );
      })}
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(cleanCode(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.length === 4) onSubmit?.();
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        maxLength={4}
        inputMode="text"
        autoComplete="one-time-code"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        autoFocus={autoFocus}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="absolute inset-0 size-full cursor-text border-0 opacity-0 focus:shadow-none"
        style={{ fontSize: 16 }}
      />
    </div>
  );
}
