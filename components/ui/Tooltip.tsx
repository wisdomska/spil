"use client";

import * as RadixTooltip from "@radix-ui/react-tooltip";

/**
 * A branded hint on hover and keyboard focus, in place of the browser's `title` tooltip (owner
 * request 2026-11-12). Only for extra detail: anything a player must read stays on the screen.
 */
export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <RadixTooltip.Provider delayDuration={250}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={6}
            collisionPadding={12}
            className="max-w-[260px] animate-[fade_150ms_both] rounded-[10px] border border-line bg-surface-raised px-3 py-2 text-[13px] leading-[1.4] font-medium text-text shadow-[0_12px_32px_-12px_var(--shadow)]"
            style={{ zIndex: "var(--z-toast)" }}
          >
            {content}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
