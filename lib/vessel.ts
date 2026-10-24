/**
 * The vessel as an input (SPIL-10). Pure helpers shared by the guess screen and the landing
 * demo: where a pointer sits on the vessel, and what a key press does.
 */
export const clampLevel = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/** Level for a pointer at `clientY` on a vessel whose top is `top` and height `height`. */
export function levelFromPointer(clientY: number, top: number, height: number): number {
  if (height <= 0) return 0;
  return clampLevel(100 - ((clientY - top) / height) * 100);
}

/** Arrows ±1, PageUp/PageDown ±10, Home 0, End 100; null for any other key. */
export function levelForKey(key: string, current: number): number | null {
  const step: Record<string, number> = {
    ArrowUp: 1,
    ArrowRight: 1,
    ArrowDown: -1,
    ArrowLeft: -1,
    PageUp: 10,
    PageDown: -10,
  };
  if (key === "Home") return 0;
  if (key === "End") return 100;
  if (key in step) return clampLevel(current + step[key]!);
  return null;
}

/** True when moving from `from` to `to` passes or lands on a multiple of 10 (haptic tick). */
export function crossesTen(from: number, to: number): boolean {
  if (from === to) return false;
  return Math.floor(from / 10) !== Math.floor(to / 10) || to % 10 === 0;
}
