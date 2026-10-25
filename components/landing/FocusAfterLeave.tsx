"use client";

import { useEffect } from "react";

/**
 * SPIL-25: after leaving a room the landing page puts focus on "Start a game", so keyboard and
 * screen reader users land somewhere useful. The room sets a one-time flag before it navigates.
 */
const KEY = "spil.left";

export function markLeft() {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {}
}

export function FocusAfterLeave({ targetId }: { targetId: string }) {
  useEffect(() => {
    let left = false;
    try {
      left = sessionStorage.getItem(KEY) === "1";
      sessionStorage.removeItem(KEY);
    } catch {}
    if (left) document.getElementById(targetId)?.focus();
  }, [targetId]);
  return null;
}
