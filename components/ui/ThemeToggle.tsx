"use client";

import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { DeviceMobileIcon, MoonIcon, SunIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import type { ThemePref } from "@/lib/theme/theme-script";
import { useTheme } from "@/lib/theme/useTheme";
import { cn } from "@/lib/cn";
import { useMounted } from "./ThemeMenu";

const OPTIONS = [
  { value: "dark", Icon: MoonIcon },
  { value: "light", Icon: SunIcon },
  { value: "system", Icon: DeviceMobileIcon },
] as const;

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
