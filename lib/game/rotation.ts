import { cryptoRng, randomIndex, type Rng } from "./types";

/** Sticker tilt in degrees. Never 0: stickers always lean. */
export const ROT = [-4, -3, -2, -1, 1, 2, 3, 4] as const;

export type Rotation = (typeof ROT)[number];

/** Upper bound (exclusive) for rotation seeds; fits a Postgres int. */
export const ROTATION_SEED_MAX = 0x7fff_ffff;

export function rotationFor(seed: number): Rotation {
  if (!Number.isInteger(seed)) throw new RangeError(`Rotation seed must be an integer: ${seed}`);
  const i = ((seed % ROT.length) + ROT.length) % ROT.length;
  return ROT[i] as Rotation;
}

export function randomRotationSeed(rng: Rng = cryptoRng): number {
  return randomIndex(rng, ROTATION_SEED_MAX);
}
