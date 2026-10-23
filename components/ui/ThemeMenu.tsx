"use client";

import { MoonIcon, SunIcon } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { forwardRef, useState, useSyncExternalStore } from "react";
import { useTheme } from "@/lib/theme/useTheme";

/** Hydration-safe: the server always renders "dark", the stored choice applies after mount. */
const noop = () => () => {};
export function useMounted() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/** The round header button. Shared by the light placeholder and the Radix menu trigger. */
export const ThemeMenuButton = forwardRef<HTMLButtonElement, React.ComponentProps<"button">>(
  function ThemeMenuButton(props, ref) {
    const t = useTranslations("theme");
    const { resolved } = useTheme();
    const shown = useMounted() ? resolved : "dark";
    const Icon = shown === "light" ? SunIcon : MoonIcon;
    return (
      <button
        ref={ref}
        type="button"
        aria-label={t("menu")}
        className="grid size-12 shrink-0 place-items-center rounded-pill border border-line bg-transparent text-[20px] text-text hover:bg-surface-raised active:scale-[.92]"
        {...props}
      >
        <Icon key={shown} size={20} aria-hidden className="block animate-icon-in" />
      </button>
    );
  },
);

const load = () => import("./ThemeMenuPopup").then((m) => m.ThemeMenuPopup);
const Popup = dynamic(load, {
  ssr: false,
  loading: () => <ThemeMenuButton aria-haspopup="menu" />,
});

/**
 * Round icon button that opens a small menu. Used in page headers. The dropdown (Radix) loads on
 * first hover, focus or tap, so it stays out of the first-load bundle of every page.
 */
export function ThemeMenu({ defaultOpen }: { defaultOpen?: boolean }) {
  const [armed, setArmed] = useState(Boolean(defaultOpen));
  const [open, setOpen] = useState(Boolean(defaultOpen));
  if (armed) return <Popup defaultOpen={open} />;
  return (
    <ThemeMenuButton
      aria-haspopup="menu"
      onPointerEnter={() => void load()}
      onFocus={() => void load()}
      onClick={() => {
        setOpen(true);
        setArmed(true);
      }}
    />
  );
}
