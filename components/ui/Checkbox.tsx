"use client";

import * as RadixCheckbox from "@radix-ui/react-checkbox";
import { CheckIcon, MinusIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

type Props = {
  checked: boolean | "indeterminate";
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  "aria-label"?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * The one checkbox in SPIL (owner request 2026-11-12): a 22 px rounded square that fills with the
 * accent, with an indeterminate dash for "some selected". The hit area is padded to 44 px.
 */
export function Checkbox({ checked, onCheckedChange, id, disabled, className, ...aria }: Props) {
  return (
    <RadixCheckbox.Root
      id={id}
      checked={checked}
      onCheckedChange={(c) => onCheckedChange(c === true)}
      disabled={disabled}
      aria-label={aria["aria-label"]}
      className={cn(
        "relative grid size-[22px] shrink-0 cursor-pointer place-items-center rounded-[7px] border-[1.5px] border-line-strong bg-bg text-on-accent",
        "after:absolute after:-inset-[11px] after:content-[''] hover:border-text-muted",
        "data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
    >
      <RadixCheckbox.Indicator className="grid place-items-center">
        {checked === "indeterminate" ? (
          <MinusIcon aria-hidden size={14} weight="bold" />
        ) : (
          <CheckIcon aria-hidden size={14} weight="bold" />
        )}
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  );
}
