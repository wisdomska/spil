"use client";

import { useSyncExternalStore } from "react";

/** Subscribes to a media query. Server and first paint assume the mobile layout. */
export function useMedia(query: string, serverValue = false) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

export const useIsDesktop = () => useMedia("(min-width: 1024px)");

/** Wide screens (1280 px and up): room screens use two columns beside the sidebar. */
export const useIsWide = () => useMedia("(min-width: 1280px)");
