"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CheckIcon, DeviceMobileIcon, MoonIcon, SunIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import type { ThemePref } from "@/lib/theme/theme-script";
import { useTheme } from "@/lib/theme/useTheme";
import { cn } from "@/lib/cn";
import { ThemeMenuButton, useMounted } from "./ThemeMenu";

const OPTIONS = [
  { value: "dark", Icon: MoonIcon },
  { value: "light", Icon: SunIcon },
  { value: "system", Icon: DeviceMobileIcon },
] as const;

/** The Radix dropdown behind ThemeMenu, loaded on demand. */
export function ThemeMenuPopup({ defaultOpen }: { defaultOpen?: boolean }) {
  const t = useTranslations("theme");
  const { pref, setPref } = useTheme();
  const current = useMounted() ? pref : "dark";
  return (
    <DropdownMenu.Root defaultOpen={defaultOpen} modal={false}>
      <DropdownMenu.Trigger asChild>
        <ThemeMenuButton />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="grid min-w-[200px] animate-rise gap-0.5 rounded-card border border-line bg-surface-raised p-1.5 shadow-[0_18px_36px_-18px_var(--shadow)]"
          style={{ zIndex: "var(--z-sheet)" }}
        >
          <DropdownMenu.RadioGroup value={current} onValueChange={(v) => setPref(v as ThemePref)}>
            {OPTIONS.map(({ value, Icon: ItemIcon }) => (
              <DropdownMenu.RadioItem
                key={value}
                value={value}
                className={cn(
                  "flex h-12 cursor-pointer items-center gap-3 rounded-pill px-3.5 text-[15px] leading-none font-semibold text-text outline-none",
                  "data-highlighted:bg-surface data-[state=checked]:bg-accent-soft",
                )}
              >
                <ItemIcon size={18} aria-hidden />
                <span className="flex-1">{t(value)}</span>
                <DropdownMenu.ItemIndicator>
                  <CheckIcon size={16} aria-hidden />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
