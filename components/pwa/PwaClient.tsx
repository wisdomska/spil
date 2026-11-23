"use client";

import { useEffect } from "react";
import { claimPush } from "@/lib/pwa/pwa";
import { installCapture } from "@/lib/pwa/install";

const CHUNK_RELOAD = "spil.chunkReload";

/** Pages where a reload would interrupt a game: an update waits until you leave them. */
const inRoom = () => location.pathname.startsWith("/r/");

/**
 * Installed-app plumbing (owner request 2026-11-23, modelled on Clink's sw-register):
 * - Registers the service worker once the page has loaded, and checks for a new version every
 *   15 minutes and whenever the app comes back to the front.
 * - A new version takes over on its own. An open page is not reloaded under you: it switches
 *   the next time it is hidden or you come back to it, and never in the middle of a room.
 * - A stale tab asking for code a new version no longer has reloads once instead of breaking.
 * - Clears the app icon badge when SPIL is opened, and keeps this device's notifications with
 *   whoever is signed in.
 * Automated browsers (tests) skip the worker unless localStorage spil.sw is "1".
 */
export function PwaClient() {
  useEffect(() => {
    installCapture();

    // A stale tab can ask for a script the new version removed: reload once.
    const onChunkError = (e: PromiseRejectionEvent | ErrorEvent) => {
      const message = String(("reason" in e ? e.reason?.message : e.message) ?? "");
      if (!/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module/.test(message))
        return;
      try {
        if (sessionStorage.getItem(CHUNK_RELOAD)) return;
        sessionStorage.setItem(CHUNK_RELOAD, "1");
      } catch {
        return;
      }
      if (!inRoom()) location.reload();
    };
    window.addEventListener("unhandledrejection", onChunkError);
    window.addEventListener("error", onChunkError);

    const nav = navigator as Navigator & { clearAppBadge?: () => Promise<void> };
    const clearBadge = () => {
      if (document.visibilityState === "visible") void nav.clearAppBadge?.().catch(() => undefined);
    };
    clearBadge();
    document.addEventListener("visibilitychange", clearBadge);

    let optIn = false;
    try {
      optIn = localStorage.getItem("spil.sw") === "1";
    } catch {}
    const enabled =
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production" &&
      (!navigator.webdriver || optIn);

    let timer: ReturnType<typeof setInterval> | undefined;
    let checkOnReturn: (() => void) | undefined;
    let pending = false;
    const switchIfQuiet = () => {
      if (pending && !inRoom()) location.reload();
    };
    const onControllerChange = () => {
      pending = true;
      if (document.visibilityState === "hidden") switchIfQuiet();
    };

    if (enabled) {
      let hadController = Boolean(navigator.serviceWorker.controller);
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        // The very first install also fires this; nothing to refresh then.
        if (!hadController) {
          hadController = true;
          return;
        }
        onControllerChange();
      });
      document.addEventListener("visibilitychange", switchIfQuiet);
      const register = () =>
        navigator.serviceWorker
          .register("/sw.js", { scope: "/" })
          .then((reg) => {
            void claimPush();
            timer = setInterval(() => reg.update().catch(() => undefined), 15 * 60 * 1000);
            checkOnReturn = () => {
              if (document.visibilityState === "visible") void reg.update().catch(() => undefined);
            };
            document.addEventListener("visibilitychange", checkOnReturn);
          })
          .catch(() => undefined);
      // After load, so installing the worker never competes with the first screen.
      if (document.readyState === "complete") void register();
      else window.addEventListener("load", () => void register(), { once: true });
    }

    return () => {
      window.removeEventListener("unhandledrejection", onChunkError);
      window.removeEventListener("error", onChunkError);
      document.removeEventListener("visibilitychange", clearBadge);
      document.removeEventListener("visibilitychange", switchIfQuiet);
      if (checkOnReturn) document.removeEventListener("visibilitychange", checkOnReturn);
      if (timer) clearInterval(timer);
    };
  }, []);
  return null;
}
