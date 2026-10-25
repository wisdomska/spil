/**
 * SPIL-22: the landing page's "{n} rooms spilled this week" line. A room counts once its reveal
 * started in the last 7 days; the line hides below a floor so a quiet week never looks empty.
 */
export const ROOM_COUNT_FLOOR = 50;
export const ROOM_COUNT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function showRoomCount(n: number): boolean {
  return Number.isFinite(n) && n >= ROOM_COUNT_FLOOR;
}
