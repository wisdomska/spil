"use client";

import { useSyncExternalStore } from "react";
import { track } from "@/lib/analytics/posthog";
import { isStandalone, platform } from "./pwa";

/**
 * The browser's install prompt (Chrome, Edge, Samsung Internet) fires once, often before the
 * screen that offers "Install" is open. installCapture() runs from the root and keeps it here
 * for any screen (modelled on Clink's lib/install.ts). iPhones never fire it: they get steps.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
let started = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function installCapture() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    track("pwa_installed", { platform: platform() });
    emit();
  });
}

export type InstallState = "installed" | "prompt" | "manual";

function read(): InstallState {
  return installed || isStandalone() ? "installed" : deferred ? "prompt" : "manual";
}

/** "installed": on the home screen already; "prompt": one tap installs; "manual": show steps. */
export function useInstallState(): InstallState {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    read,
    () => "manual",
  );
}

/** Opens the browser's install dialog. Resolves true when they installed. */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  await e.prompt();
  const { outcome } = await e.userChoice;
  deferred = null;
  if (outcome === "accepted") installed = true;
  emit();
  return outcome === "accepted";
}
