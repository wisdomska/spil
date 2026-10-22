"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { cn } from "@/lib/cn";

type Item<T extends string> = { value: T; label: React.ReactNode };

type SegmentedTabsProps<T extends string> = {
  items: Array<Item<T>>;
  value: T;
  onValueChange: (value: T) => void;
  label: string;
  /** Fit to content on desktop instead of full width. */
  fit?: boolean;
  className?: string;
  children?: React.ReactNode;
};

/** Pill segmented tabs. Switching is not animated (HANDOFF). */
export function SegmentedTabs<T extends string>({
  items,
  value,
  onValueChange,
  label,
  fit = true,
  className,
  children,
}: SegmentedTabsProps<T>) {
  return (
    <Tabs.Root value={value} onValueChange={(v) => onValueChange(v as T)} activationMode="manual">
      <Tabs.List
        aria-label={label}
        className={cn(
          "grid w-full max-w-full gap-0.5 rounded-pill border border-line bg-surface p-1",
          fit && "lg:w-fit",
          className,
        )}
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => (
          <Tabs.Trigger
            key={item.value}
            value={item.value}
            className={cn(
              "h-11 min-w-0 rounded-pill border-0 px-1.5 text-[14px] leading-none font-semibold whitespace-nowrap lg:px-5 lg:text-[15px]",
              "data-[state=active]:bg-surface-raised data-[state=active]:text-text data-[state=active]:shadow-[0_1px_0_var(--line)]",
              "data-[state=inactive]:bg-transparent data-[state=inactive]:text-text-muted data-[state=inactive]:hover:bg-surface-raised data-[state=inactive]:hover:text-text",
            )}
          >
            {item.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {children}
    </Tabs.Root>
  );
}

export const TabPanel = Tabs.Content;
