import {
  toMs,
  toMsOrNull,
  type Check,
  type PlayerStatus,
  type RoomStatus,
  type TimeInput,
} from "./types";

/** Joining is blocked once a room is this old. */
export const JOIN_WINDOW_MS = 24 * 60 * 60 * 1000;
/** A host with no heartbeat for this long hands over to the next player. */
export const HOST_INACTIVE_MS = 10 * 60 * 1000;

/** Forward transitions. `closed` is terminal; rematch goes `revealed -> lobby`. */
export const NEXT_PHASE: Readonly<Partial<Record<RoomStatus, RoomStatus>>> = {
  lobby: "answering",
  answering: "guessing",
  guessing: "ready",
  ready: "revealed",
};

export interface PhasePlayer {
  id: string;
  status: PlayerStatus;
  joinedAt: TimeInput;
  answersSubmittedAt?: TimeInput | null;
  guessesSubmittedAt?: TimeInput | null;
  ageConfirmed?: boolean;
  lastSeenAt?: TimeInput | null;
}

export function activePlayers<P extends PhasePlayer>(players: readonly P[]): P[] {
  return players.filter((p) => p.status === "active");
}

export interface StartInput {
  status: RoomStatus;
  players: readonly PhasePlayer[];
  minPlayers: number;
  packIsAdult: boolean;
}

export type StartError = "WRONG_PHASE" | "NOT_ENOUGH_PLAYERS" | "AGE_PENDING";

/** Start needs the lobby, `minPlayers` active players and, for adult packs, everyone's 18+ confirmation. */
export function canStart({
  status,
  players,
  minPlayers,
  packIsAdult,
}: StartInput): Check<StartError> {
  if (status !== "lobby") return { ok: false, code: "WRONG_PHASE" };
  const active = activePlayers(players);
  if (active.length < minPlayers) return { ok: false, code: "NOT_ENOUGH_PLAYERS" };
  if (packIsAdult && active.some((p) => !p.ageConfirmed)) return { ok: false, code: "AGE_PENDING" };
  return { ok: true };
}

export interface JoinRoom {
  status: RoomStatus;
  createdAt: TimeInput;
}

export interface JoinInput {
  /** null when no live room has the code. */
  room: JoinRoom | null;
  activeCount: number;
  maxPlayers: number;
  now: TimeInput;
}

export type JoinError = "ROOM_NOT_FOUND" | "ROOM_EXPIRED" | "GAME_STARTED" | "ROOM_FULL";

export function isRoomExpired(room: JoinRoom, now: TimeInput): boolean {
  return room.status === "closed" || toMs(now) - toMs(room.createdAt) >= JOIN_WINDOW_MS;
}

/** Join only in the lobby, under `maxPlayers`, room not closed and under 24 hours old. */
export function canJoin({ room, activeCount, maxPlayers, now }: JoinInput): Check<JoinError> {
  if (!room) return { ok: false, code: "ROOM_NOT_FOUND" };
  if (isRoomExpired(room, now)) return { ok: false, code: "ROOM_EXPIRED" };
  if (room.status !== "lobby") return { ok: false, code: "GAME_STARTED" };
  if (activeCount >= maxPlayers) return { ok: false, code: "ROOM_FULL" };
  return { ok: true };
}

/** Every active player has locked their answers (and there is at least one). */
export function allAnswered(players: readonly PhasePlayer[]): boolean {
  const active = activePlayers(players);
  return active.length > 0 && active.every((p) => p.answersSubmittedAt != null);
}

/** Every active player has locked their guesses (and there is at least one). */
export function allGuessed(players: readonly PhasePlayer[]): boolean {
  const active = activePlayers(players);
  return active.length > 0 && active.every((p) => p.guessesSubmittedAt != null);
}

/** Active players still holding up a phase; the host's force-advance confirm lists these. */
export function unfinishedPlayers<P extends PhasePlayer>(
  players: readonly P[],
  phase: "answering" | "guessing",
): P[] {
  const key = phase === "answering" ? "answersSubmittedAt" : "guessesSubmittedAt";
  return activePlayers(players).filter((p) => p[key] == null);
}

/**
 * Phase the room should move to after a submit, or null to stay. Only answering and guessing
 * advance automatically; ready waits for the host to tap Reveal.
 */
export function autoAdvance(
  status: RoomStatus,
  players: readonly PhasePlayer[],
): RoomStatus | null {
  if (status === "answering" && allAnswered(players)) return "guessing";
  if (status === "guessing" && allGuessed(players)) return "ready";
  return null;
}

/** save_results must run once per round, even if Reveal is called twice. */
export function needsFinalize(room: { round: number; finalRound: number }): boolean {
  return room.finalRound !== room.round;
}

export function isHostInactive(host: PhasePlayer, now: TimeInput): boolean {
  if (host.status !== "active") return true;
  const seen = toMsOrNull(host.lastSeenAt);
  return seen == null ? false : toMs(now) - seen >= HOST_INACTIVE_MS;
}

/**
 * Who should host. The room's creator (`creatorId`) hosts whenever they are active and seen in
 * the last 10 minutes, so hosting comes back to them after a stretch away from the app. Otherwise
 * the current host keeps it on the same terms, and failing that it passes to the earliest-joined
 * active player, preferring ones with a recent heartbeat. Returns null when nobody active is left.
 */
export function nextHost(
  players: readonly PhasePlayer[],
  currentHostId: string | null,
  now: TimeInput,
  creatorId?: string | null,
): string | null {
  const creator = creatorId ? players.find((p) => p.id === creatorId) : undefined;
  if (creator && !isHostInactive(creator, now)) return creator.id;
  const current = players.find((p) => p.id === currentHostId);
  if (current && !isHostInactive(current, now)) return current.id;
  const others = activePlayers(players)
    .filter((p) => p.id !== currentHostId)
    .sort((a, b) => toMs(a.joinedAt) - toMs(b.joinedAt));
  const fresh = others.find((p) => !isHostInactive(p, now));
  return (fresh ?? others[0])?.id ?? null;
}

export interface RematchPlayer extends PhasePlayer {
  ageConfirmed: boolean;
  spillMode: boolean;
}

export interface RematchResult<P extends RematchPlayer> {
  status: "lobby";
  round: number;
  players: P[];
}

/**
 * Same room, next round: back to the lobby with answers, guesses and Spill Mode cleared
 * (answers and guesses are keyed by round, so the new round starts empty). Players who sat out
 * come back. Switching to an adult pack clears every 18+ confirmation.
 */
export function rematch<P extends RematchPlayer>(
  room: { status: RoomStatus; round: number },
  players: readonly P[],
  next: { packIsAdult: boolean },
): RematchResult<P> {
  if (room.status !== "revealed")
    throw new Error(`Rematch needs a revealed room, got ${room.status}`);
  return {
    status: "lobby",
    round: room.round + 1,
    players: players.map((p) => ({
      ...p,
      status: p.status === "sat_out" ? "active" : p.status,
      answersSubmittedAt: null,
      guessesSubmittedAt: null,
      spillMode: false,
      ageConfirmed: next.packIsAdult ? false : p.ageConfirmed,
    })),
  };
}
