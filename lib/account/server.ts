import "server-only";
import { randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { makeRecoveryCode, normalizeRecoveryCode } from "./rules";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const KEY_LEN = 32;

/**
 * Accounts have no email (owner decision 2026-10-26). Supabase signs in with an email, so each
 * account gets this address, which is never shown, never sent to and cannot receive mail.
 */
export function placeholderEmail(userId: string) {
  return `${userId}@players.spil.invalid`;
}

export function newRecoveryCode() {
  return makeRecoveryCode((max) => randomInt(max));
}

/** "scrypt:<salt hex>:<hash hex>". Only this is stored; the code is shown once. */
export async function hashRecoveryCode(code: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(normalizeRecoveryCode(code), salt, KEY_LEN);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function recoveryCodeMatches(code: string, stored: string) {
  const [kind, saltHex, hashHex] = stored.split(":");
  if (kind !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(
    normalizeRecoveryCode(code),
    Buffer.from(saltHex, "hex"),
    expected.length,
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
