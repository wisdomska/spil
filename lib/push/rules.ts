/**
 * Push notification rules (owner request 2026-11-23, modelled on Clink). Pure, so the server
 * sender and the tests share them.
 */

export type RoomEvent = "started" | "guessing" | "ready" | "rematch";

/** The game update a phase change is worth a buzz for, or null when it is not. */
export function eventForTransition(from: string, to: string): RoomEvent | null {
  if (from === "lobby" && to === "answering") return "started";
  if (from === "answering" && to === "guessing") return "guessing";
  if (to === "ready" && from !== "ready") return "ready";
  if (from === "revealed" && to === "lobby") return "rematch";
  return null;
}

/** A player is only buzzed when the room has not seen them for this long (not looking at it). */
export const AWAY_MS = 20_000;

export type PushCandidate = {
  userId: string;
  isBot: boolean;
  status: string;
  lastSeenAt: string;
};

/**
 * Who gets a game update: real players still in the room (a rematch also brings back anyone who
 * sat the last round out) who have not looked at it in the last 20 s, never the person whose tap
 * caused the change.
 */
export function roomRecipients(
  players: readonly PushCandidate[],
  event: RoomEvent,
  now: number,
  exceptUserId?: string | null,
): string[] {
  const statuses = event === "rematch" ? ["active", "sat_out"] : ["active"];
  const ids = players
    .filter(
      (p) =>
        !p.isBot &&
        statuses.includes(p.status) &&
        p.userId !== exceptUserId &&
        now - Date.parse(p.lastSeenAt) >= AWAY_MS,
    )
    .map((p) => p.userId);
  return [...new Set(ids)];
}

/** How long a push service keeps trying: game updates are stale in 10 minutes, the daily in 6 h. */
export const TTL = { room: 600, daily: 6 * 3600 } as const;

/** A push service answers 404 or 410 when the subscription is gone for good. */
export const isGone = (status: number | undefined) => status === 404 || status === 410;
