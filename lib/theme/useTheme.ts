"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { THEME_COLOR, THEME_KEY, type ThemePref } from "./theme-script";

const listeners = new Set<() => void>();

function readPref(): ThemePref {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "system" ? value : "dark";
  } catch {
    return "dark";
  }
}

function prefersLight() {
  return window.matchMedia("(prefers-color-scheme: light)").matches;
}

export function resolveTheme(pref: ThemePref): "dark" | "light" {
  if (pref === "system") return prefersLight() ? "light" : "dark";
  return pref;
}

export function applyTheme(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === "system") root.removeAttribute("data-theme");
  else root.dataset.theme = pref;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLOR[resolveTheme(pref)]);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia("(prefers-color-scheme: light)");
  media.addEventListener("change", listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", listener);
    window.removeEventListener("storage", listener);
  };
}

export function useTheme() {
  const pref = useSyncExternalStore(subscribe, readPref, () => "dark" as ThemePref);
  const resolved = useSyncExternalStore(
    subscribe,
    () => resolveTheme(readPref()),
    () => "dark" as const,
  );

  // Keep the attribute in sync when the OS theme flips under "system".
  useEffect(() => {
    if (pref === "system") applyTheme("system");
  }, [pref, resolved]);

  const setPref = useCallback((next: ThemePref) => {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // storage blocked: the choice still applies for this page view
    }
    applyTheme(next);
    listeners.forEach((listener) => listener());
  }, []);

  return { pref, resolved, setPref };
}
