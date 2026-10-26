/**
 * Optional accounts (owner decision 2026-10-26): username, password and recovery code rules.
 * Pure, so the client shows the same answers the server enforces.
 */
import { isProfane } from "@/lib/validation/profanity";

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const PASSWORD_MIN = 10;

export type UsernameProblem = "length" | "chars" | "blocked";
export type PasswordProblem = "short" | "common" | "username";

/** Letters, numbers and underscores, 3 to 20 of them; checked by the nickname filter. */
export function usernameProblem(raw: string): UsernameProblem | null {
  const name = raw.trim();
  if (name.length < USERNAME_MIN || name.length > USERNAME_MAX) return "length";
  if (!/^[A-Za-z0-9_]+$/.test(name)) return "chars";
  if (isProfane(name.replace(/_/g, " "))) return "blocked";
  return null;
}

/**
 * The most used passwords that pass the length rule, plus shapes a guesser tries first. Short
 * on purpose: sign-in is rate limited, so this only has to stop the obvious ones.
 */
const COMMON = new Set([
  "1234567890",
  "0123456789",
  "12345678910",
  "123456789a",
  "a123456789",
  "1q2w3e4r5t",
  "qwertyuiop",
  "asdfghjkl1",
  "zxcvbnm123",
  "password12",
  "password123",
  "password1234",
  "passw0rd123",
  "iloveyou12",
  "iloveyou123",
  "1qaz2wsx3edc",
  "qwerty1234",
  "qwerty12345",
  "abc1234567",
  "abcdefghij",
  "letmein123",
  "welcome123",
  "football12",
  "football123",
  "princess12",
  "sunshine12",
  "monkey12345",
  "dragon12345",
  "spilparty1",
  "spilspil12",
]);

/** 10 or more characters; not a common password, a single repeated character or the username. */
export function passwordProblem(password: string, username = ""): PasswordProblem | null {
  if (password.length < PASSWORD_MIN) return "short";
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password)) return "common";
  // A plain run like 1234567890 or abcdefghij.
  const codes = [...lower].map((c) => c.charCodeAt(0));
  if (codes.every((c, i) => i === 0 || c - codes[i - 1]! === 1)) return "common";
  const user = username.trim().toLowerCase();
  if (user && lower.includes(user)) return "username";
  return null;
}

/** No 0, O, 1, I or L, so a code read off a screenshot cannot be misread. */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_GROUPS = 4;
const GROUP_SIZE = 4;

/**
 * A one-time recovery code like 7KQX-M2RD-PW9T-4HZC (about 79 bits). `randomInt(max)` must be
 * uniform and cryptographically strong (node:crypto randomInt on the server).
 */
export function makeRecoveryCode(randomInt: (max: number) => number): string {
  const chars = Array.from(
    { length: CODE_GROUPS * GROUP_SIZE },
    () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
  );
  return Array.from({ length: CODE_GROUPS }, (_, g) =>
    chars.slice(g * GROUP_SIZE, (g + 1) * GROUP_SIZE).join(""),
  ).join("-");
}

/** Accepts the code however it was typed: any case, with or without dashes and spaces. */
export function normalizeRecoveryCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
