import { isMode, type Mode } from "@/lib/game";

/**
 * The last game this phone set up (two-step setup), so a returning host can start it again in
 * one tap. localStorage "spil.lastGame" = { mode, packId, count }. Never sent anywhere; storage
 * can be blocked, so every access is guarded.
 */
const KEY = "spil.lastGame";

export type LastGame = { mode: Mode; packId: string; count: number };

export function parseLastGame(raw: string | null): LastGame | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<LastGame>;
    if (!isMode(v.mode) || typeof v.packId !== "string" || !v.packId) return null;
    if (typeof v.count !== "number" || !Number.isInteger(v.count) || v.count < 1) return null;
    return { mode: v.mode, packId: v.packId, count: v.count };
  } catch {
    return null;
  }
}

export function readLastGame(): LastGame | null {
  try {
    return parseLastGame(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function saveLastGame(game: LastGame) {
  try {
    localStorage.setItem(KEY, JSON.stringify(game));
  } catch {
    // storage blocked: no "Play again" next time
  }
}
