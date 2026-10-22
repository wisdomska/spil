"use client";

import * as RadixSwitch from "@radix-ui/react-switch";
import { cn } from "@/lib/cn";

type SwitchRowProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  /** "card" is the bordered panel (Spill Mode, 18+), "plain" is a flat row (Hide my name). */
  look?: "card" | "plain";
  invalid?: boolean;
  className?: string;
  id?: string;
};

/** Track 52 x 32, knob 26, knob slides 20px with the switch spring (HANDOFF "switch"). */
export function SwitchTrack({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative block h-8 w-[52px] shrink-0 rounded-pill transition-colors duration-150",
        checked ? "bg-accent" : "bg-line",
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] left-[3px] block size-[26px] rounded-pill",
          checked ? "bg-on-accent" : "bg-text",
        )}
        style={{
          transform: `translateX(${checked ? 20 : 0}px)`,
          transition: "transform 200ms var(--ease-switch), background-color 150ms ease",
        }}
      />
    </span>
  );
}

export function SwitchRow({
  checked,
  onCheckedChange,
  title,
  description,
  icon,
  look = "card",
  invalid,
  className,
  id,
}: SwitchRowProps) {
  return (
    <RadixSwitch.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-invalid={invalid || undefined}
      className={cn(
        "flex w-full items-center gap-3.5 text-left text-text",
        look === "card"
          ? cn(
              "rounded-card border bg-surface p-4 hover:border-text-muted",
              invalid ? "border-error" : "border-line",
            )
          : "min-h-12 rounded-input border-0 bg-transparent py-1 pr-1 pl-2 hover:bg-surface-raised",
        className,
      )}
    >
      {icon}
      <span className="grid flex-1 gap-1">
        <span
          className={cn(
            "leading-[1.2]",
            look === "card" ? "text-[17px] font-bold" : "text-[15px] leading-[1.3] font-semibold",
          )}
        >
          {title}
        </span>
        {description && (
          <span className="text-[14px] leading-[1.4] text-text-muted">{description}</span>
        )}
      </span>
      <SwitchTrack checked={checked} />
    </RadixSwitch.Root>
  );
}
