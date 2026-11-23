"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isStandalone } from "@/lib/pwa/pwa";

const DONE = "spil.launched";

/**
 * Opened from the home screen, SPIL skips the landing page and starts on the game picker, like
 * Clink opening straight into the app (owner request 2026-11-23). Only once per launch, so the
 * logo still leads back to the landing page afterwards.
 */
export function InstalledRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (!isStandalone()) return;
    try {
      if (sessionStorage.getItem(DONE)) return;
      sessionStorage.setItem(DONE, "1");
    } catch {}
    router.replace("/create");
  }, [router]);
  return null;
}
