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

/**
 * Has a score this round, so others guess about them: active, or sat out only the guessing
 * phase (sat out after submitting answers).
 */
export function isScoredPlayer(p: PhasePlayer): boolean {
  return p.status === "active" || (p.status === "sat_out" && p.answersSubmittedAt != null);
}

/** Who `meId` guesses about: every other scored player. */
export function guessTargets<P extends PhasePlayer>(players: readonly P[], meId: string): P[] {
  return players.filter((p) => p.id !== meId && isScoredPlayer(p));
}

/**
 * Who the guessing phase waits for: everyone still in the game, including players who sat out
 * answering ("They can still guess."). Left and removed players are out.
 */
export function guessingPlayers<P extends PhasePlayer>(players: readonly P[]): P[] {
  return players.filter((p) => p.status === "active" || p.status === "sat_out");
}

/** Everyone the guessing phase waits for has locked their guesses (and there is at least one). */
export function allGuessed(players: readonly PhasePlayer[]): boolean {
  const waiting = guessingPlayers(players);
  return waiting.length > 0 && waiting.every((p) => p.guessesSubmittedAt != null);
}

/** Players still holding up a phase; the host's force-advance confirm lists these. */
export function unfinishedPlayers<P extends PhasePlayer>(
  players: readonly P[],
  phase: "answering" | "guessing",
): P[] {
  if (phase === "answering") return activePlayers(players).filter((p) => !p.answersSubmittedAt);
  return guessingPlayers(players).filter((p) => p.guessesSubmittedAt == null);
}

export interface AdvancePlan {
  /** Players to lock now because they have nobody to guess about. */
  lock: string[];
  /** Phase to move to, or null to stay. */
  to: RoomStatus | null;
}

/**
 * What the server does next (SPIL-01). In guessing, a player with no targets (everyone else sat
 * out or left) is locked straight away, so they can never hold the room up. Then answering moves
 * on when every active player has answered, and guessing when everyone still in the game has
 * locked. Ready waits for the host to tap Reveal. Locks only ever go one way, so applying a plan
 * computed from a slightly old read is safe.
 */
export function planAdvance(status: RoomStatus, players: readonly PhasePlayer[]): AdvancePlan {
  if (status === "answering") return { lock: [], to: allAnswered(players) ? "guessing" : null };
  if (status !== "guessing") return { lock: [], to: null };
  const lock = guessingPlayers(players)
    .filter((p) => p.guessesSubmittedAt == null && guessTargets(players, p.id).length === 0)
    .map((p) => p.id);
  const after = players.map((p) =>
    lock.includes(p.id) ? { ...p, guessesSubmittedAt: p.guessesSubmittedAt ?? 0 } : p,
  );
  return { lock, to: allGuessed(after) ? "ready" : null };
}

/** Phase the room should move to after a submit, or null to stay. */
export function autoAdvance(
  status: RoomStatus,
  players: readonly PhasePlayer[],
): RoomStatus | null {
  return planAdvance(status, players).to;
}

/** A live room with no change for this long shows as stuck in the admin console (SPIL-01). */
export const STUCK_AFTER_MS = 20 * 60 * 1000;

/** In answering, guessing or ready and untouched for 20 minutes: worth an admin's look. */
export function isStuck(room: { status: RoomStatus; updatedAt: TimeInput }, now: TimeInput) {
  const live = room.status === "answering" || room.status === "guessing" || room.status === "ready";
  return live && toMs(now) - toMs(room.updatedAt) >= STUCK_AFTER_MS;
}

/** The host may skip to the reveal once guessing has run this long (SPIL-01). */
export const SKIP_TO_REVEAL_MS = 60 * 1000;

export function canSkipToReveal(
  room: { status: RoomStatus; guessingAt: TimeInput | null },
  now: TimeInput,
) {
  const since = toMsOrNull(room.guessingAt);
  return room.status === "guessing" && since != null && toMs(now) - since >= SKIP_TO_REVEAL_MS;
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
