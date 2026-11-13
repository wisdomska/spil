"use client";

import * as RadixSelect from "@radix-ui/react-select";
import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

/** Radix Select needs a non-empty value; "" (for "any" or "all") travels under this key. */
const EMPTY = "__empty__";
const toRadix = (v: string) => (v === "" ? EMPTY : v);
const fromRadix = (v: string) => (v === EMPTY ? "" : v);

export type SelectOption = { value: string; label: React.ReactNode; disabled?: boolean };

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  placeholder?: string;
  disabled?: boolean;
  /** md is the 48 px form field; sm is the 36 px pill used in toolbars and pagination. */
  size?: "md" | "sm";
  className?: string;
};

/**
 * The one dropdown in SPIL (owner request 2026-11-12: no browser default lists anywhere). Radix
 * Select gives keyboard, typeahead and screen reader support; the list is our surface, tokens only.
 */
export function Select({
  value,
  onValueChange,
  options,
  id,
  placeholder,
  disabled,
  size = "md",
  className,
  ...aria
}: Props) {
  return (
    <RadixSelect.Root
      value={toRadix(value)}
      onValueChange={(v) => onValueChange(fromRadix(v))}
      disabled={disabled}
    >
      <RadixSelect.Trigger
        id={id}
        aria-label={aria["aria-label"]}
        aria-describedby={aria["aria-describedby"]}
        className={cn(
          "group box-border inline-flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 border-[1.5px] text-left text-text outline-none",
          "hover:border-text-muted focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] data-[state=open]:border-accent",
          "disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-text-muted",
          size === "md"
            ? "h-12 rounded-input border-line-strong bg-bg px-3.5 text-[15px] font-medium"
            : "h-9 rounded-pill border-line bg-transparent px-3 font-mono text-[13px] font-semibold",
          className,
        )}
      >
        <span className="min-w-0 truncate">
          <RadixSelect.Value placeholder={placeholder} />
        </span>
        <RadixSelect.Icon asChild>
          <CaretDownIcon
            aria-hidden
            size={size === "md" ? 16 : 12}
            className="shrink-0 text-text-muted transition-transform duration-150 group-data-[state=open]:rotate-180"
          />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          className="max-h-[min(360px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] animate-[fade_150ms_both] overflow-hidden rounded-input border border-line bg-surface-raised text-text shadow-[0_16px_40px_-12px_var(--shadow)]"
          style={{ zIndex: "calc(var(--z-sheet) + 5)" }}
        >
          <RadixSelect.Viewport className="p-1.5">
            {options.map((o) => (
              <RadixSelect.Item
                key={o.value}
                value={toRadix(o.value)}
                disabled={o.disabled}
                className={cn(
                  "relative flex min-h-10 cursor-pointer items-center gap-2 rounded-[10px] py-2 pr-9 pl-3 text-[15px] leading-tight font-medium outline-none select-none",
                  "data-[highlighted]:bg-accent-soft data-[highlighted]:text-text data-[state=checked]:text-accent-ink",
                  "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40",
                )}
              >
                <RadixSelect.ItemText>{o.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="absolute right-3 inline-flex">
                  <CheckIcon aria-hidden size={16} weight="bold" />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
