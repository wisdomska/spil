/**
 * SPIL-31: a short buzz when an answer is committed and when a guess locks in. Only where the
 * Vibration API exists (Android browsers); iOS and desktop do nothing, and reduced motion skips
 * it. Never throws.
 */
export function haptic(ms = 10) {
  try {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    navigator.vibrate(ms);
  } catch {
    // some browsers throw when vibration is blocked; a missing buzz is fine
  }
}
