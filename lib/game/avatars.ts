/**
 * Avatar faces (SPIL-26). Index order matches AVATAR_EMOJI and players.avatar, so only append.
 * Each face has a name for screen readers. The random first pick never lands on a face that
 * could read badly (Hot face, Clown, Skull), and Hot face is offered only in 18+ rooms.
 */
export const AVATAR_KEYS = [
  "devil",
  "smirk",
  "giggle",
  "seeNoEvil",
  "cowboy",
  "party",
  "cool",
  "zany",
  "cheeky",
  "shush",
  "angel",
  "hotFace",
  "mindBlown",
  "woozy",
  "ghost",
  "alien",
  "clown",
  "skull",
  "nerd",
  "cat",
  "frog",
  "fox",
  "panda",
  "unicorn",
] as const;
export type AvatarKey = (typeof AVATAR_KEYS)[number];

const HOT_FACE = AVATAR_KEYS.indexOf("hotFace");
const NOT_RANDOM = new Set([HOT_FACE, AVATAR_KEYS.indexOf("clown"), AVATAR_KEYS.indexOf("skull")]);

/** Faces a player can pick: everything in an 18+ room, everything but Hot face otherwise. */
export function offeredAvatars(adultRoom: boolean): number[] {
  return AVATAR_KEYS.map((_, i) => i).filter((i) => adultRoom || i !== HOT_FACE);
}

/** The random first face: always from the safe list. `rng` returns [0, 1). */
export function randomAvatar(rng: () => number = Math.random): number {
  const safe = AVATAR_KEYS.map((_, i) => i).filter((i) => !NOT_RANDOM.has(i));
  return safe[Math.min(safe.length - 1, Math.floor(rng() * safe.length))]!;
}

export function avatarKey(n: number): AvatarKey {
  return AVATAR_KEYS[n] ?? AVATAR_KEYS[0];
}
