import { cryptoRng, randomIndex, type Rng } from "./types";

/** No I, O, 0 or 1, so codes survive being read aloud or written on a napkin. */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 4;
export const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{4}$/;

/** Generates one room code. Pass an RNG in tests; production uses crypto randomness. */
export function generateCode(rng: Rng = cryptoRng): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++)
    code += CODE_ALPHABET.charAt(randomIndex(rng, CODE_ALPHABET.length));
  return code;
}

/** Uppercases and trims user input so "k7qx " matches "K7QX". */
export function normalizeCode(input: string): string {
  return input.trim().toUpperCase();
}

export function isValidCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}

export interface UniqueCodeOptions {
  rng?: Rng;
  maxAttempts?: number;
}

/**
 * Generates a code that `isTaken` reports as free (a code is only taken by a live room).
 * Throws after `maxAttempts` collisions so a full code space never loops forever.
 */
export function generateUniqueCode(
  isTaken: (code: string) => boolean,
  { rng = cryptoRng, maxAttempts = 50 }: UniqueCodeOptions = {},
): string {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateCode(rng);
    if (!isTaken(code)) return code;
  }
  throw new Error(`No free room code after ${maxAttempts} attempts`);
}
