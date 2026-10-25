import { describe, expect, it } from "vitest";
import { AVATAR_EMOJI } from "@/components/brand/Avatar";
import { AVATAR_KEYS, avatarKey, offeredAvatars, randomAvatar } from "@/lib/game";

// SPIL-26: named faces, a safe random default, Hot face only in 18+ rooms.
describe("avatars", () => {
  it("names every face", () => {
    expect(AVATAR_KEYS).toHaveLength(AVATAR_EMOJI.length);
    expect(avatarKey(14)).toBe("ghost");
  });
  it("never picks Hot face, Clown or Skull at random", () => {
    const bad = new Set([11, 16, 17]);
    for (let k = 0; k < 1000; k++) expect(bad.has(randomAvatar(() => k / 1000))).toBe(false);
    expect(randomAvatar(() => 0.999999)).toBe(23);
  });
  it("offers Hot face only in 18+ rooms", () => {
    expect(offeredAvatars(true)).toContain(11);
    expect(offeredAvatars(false)).not.toContain(11);
    expect(offeredAvatars(false)).toHaveLength(23);
  });
});
