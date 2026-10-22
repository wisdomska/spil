/** A source of uniform random numbers in [0, 1). Injected so tests are deterministic. */
export type Rng = () => number;

export type RoomStatus = "lobby" | "answering" | "guessing" | "ready" | "revealed" | "closed";

export type PlayerStatus = "active" | "left" | "removed" | "sat_out";

export type AnswerValue = "yes" | "no" | "skip";

export type ContentStatus = "live" | "draft" | "hidden";

/** Epoch milliseconds, an ISO 8601 string, or a Date. */
export type TimeInput = number | string | Date;

/** Result of a rule check: either allowed, or refused with an API error code. */
export type Check<Code extends string> = { ok: true } | { ok: false; code: Code };

export function toMs(value: TimeInput): number {
  const ms =
    value instanceof Date ? value.getTime() : typeof value === "string" ? Date.parse(value) : value;
  if (!Number.isFinite(ms)) throw new RangeError(`Invalid time: ${String(value)}`);
  return ms;
}

export function toMsOrNull(value: TimeInput | null | undefined): number | null {
  return value == null ? null : toMs(value);
}

/** Crypto-backed RNG. Uses the Web Crypto API available in Node 20+ and browsers. */
export const cryptoRng: Rng = () => {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return (buf[0] ?? 0) / 0x1_0000_0000;
};

/** Picks an integer in [0, n) from an RNG, clamped so a misbehaving RNG cannot go out of range. */
export function randomIndex(rng: Rng, n: number): number {
  const i = Math.floor(rng() * n);
  return Math.min(n - 1, Math.max(0, Number.isFinite(i) ? i : 0));
}
