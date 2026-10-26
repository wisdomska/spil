"use client";

import { useSyncExternalStore } from "react";

/**
 * Which account this phone is signed in to, so the header menu can offer Sign out without asking
 * the server on every page. localStorage "spil.account" = username. The server stays the truth:
 * the profile page checks it and corrects this value.
 */
const KEY = "spil.account";
const CHANGED = "spil:account";

function notify() {
  try {
    window.dispatchEvent(new Event(CHANGED));
  } catch {}
}

export function saveAccount(username: string) {
  try {
    localStorage.setItem(KEY, username);
    notify();
  } catch {}
}

export function clearAccount() {
  try {
    localStorage.removeItem(KEY);
    notify();
  } catch {}
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => e.key === KEY && onChange();
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function snapshot() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** The signed-in username on this phone, or null for a guest. */
export function useDeviceAccount() {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
