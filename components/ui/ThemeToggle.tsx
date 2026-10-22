"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { CheckIcon, DeviceMobileIcon, MoonIcon, SunIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import type { ThemePref } from "@/lib/theme/theme-script";
import { useTheme } from "@/lib/theme/useTheme";
import { cn } from "@/lib/cn";

const OPTIONS = [
  { value: "dark", Icon: MoonIcon },
  { value: "light", Icon: SunIcon },
  { value: "system", Icon: DeviceMobileIcon },
] as const;

/** Hydration-safe: the server always renders "dark", the stored choice applies after mount. */
const noop = () => () => {};
function useMounted() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/** Three pill segments (Dark, Light, System). Used in the desktop room panel. */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("theme");
  const { pref, setPref } = useTheme();
  const mounted = useMounted();
  const value = mounted ? pref : "dark";
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={t("label")}
      value={value}
      onValueChange={(next) => next && setPref(next as ThemePref)}
      className={cn("flex gap-0.5 rounded-pill border border-line p-1", className)}
    >
      {OPTIONS.map(({ value: option, Icon }) => (
        <ToggleGroup.Item
          key={option}
          value={option}
          className={cn(
            "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-pill border-0 text-[13px] leading-none font-semibold",
            value === option
              ? "bg-text text-bg"
              : "bg-transparent text-text-muted hover:bg-surface-raised hover:text-text",
          )}
        >
          {value === option ? (
            <Icon key={option} size={16} aria-hidden className="animate-icon-in" />
          ) : (
            <Icon size={16} aria-hidden />
          )}
          {t(option)}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

/** Round icon button that opens a small menu. Used in page headers. */
export function ThemeMenu({ defaultOpen }: { defaultOpen?: boolean }) {
  const t = useTranslations("theme");
  const { pref, resolved, setPref } = useTheme();
  const mounted = useMounted();
  const shown = mounted ? resolved : "dark";
  const current = mounted ? pref : "dark";
  const Icon = shown === "light" ? SunIcon : MoonIcon;
  return (
    <DropdownMenu.Root defaultOpen={defaultOpen} modal={false}>
      <DropdownMenu.Trigger
        aria-label={t("menu")}
        className="grid size-12 shrink-0 place-items-center rounded-pill border border-line bg-transparent text-[20px] text-text hover:bg-surface-raised active:scale-[.92]"
      >
        <Icon key={shown} size={20} aria-hidden className="block animate-icon-in" />
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
