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

const isCode = (s: string) => s.length === 4 && [...s].every((ch) => CODE_ALPHABET.includes(ch));

/**
 * The room code inside whatever was pasted: an invite link (/r/ABCD or ?code=ABCD), a message
 * with the code in it ("Join my SPIL room ABCD"), or the code itself. Null when there is none.
 */
export function codeIn(raw: string): string | null {
  const link =
    raw.match(/\/r\/([A-Za-z0-9]{4})(?![A-Za-z0-9])/) ?? raw.match(/[?&]code=([A-Za-z0-9]{4})\b/);
  if (link) {
    const code = (link[1] ?? "").toUpperCase();
    return isCode(code) ? code : null;
  }
  const whole = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (isCode(whole)) return whole;
  const words = raw.split(/\s+/).map((w) => w.toUpperCase().replace(/[^A-Z0-9]/g, ""));
  return words.reverse().find(isCode) ?? null;
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
        // No maxLength: a pasted invite link must arrive whole so the code can be found in it.
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw.length > 5 ? (codeIn(raw) ?? cleanCode(raw)) : cleanCode(raw));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.length === 4) onSubmit?.();
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
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
