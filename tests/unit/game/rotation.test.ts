import { describe, expect, it } from "vitest";
import { ROT, ROTATION_SEED_MAX, randomRotationSeed, rotationFor } from "@/lib/game";
import { seededRng } from "./fixtures";

describe("rotation", () => {
  it("ROT is the spec table and never 0", () => {
    expect(ROT).toEqual([-4, -3, -2, -1, 1, 2, 3, 4]);
    expect(ROT).not.toContain(0);
  });

  it("maps seed % 8 onto ROT", () => {
    ROT.forEach((r, i) => {
      expect(rotationFor(i)).toBe(r);
      expect(rotationFor(i + 8)).toBe(r);
      expect(rotationFor(i + 8 * 1000)).toBe(r);
    });
  });

  it("handles negative seeds", () => {
    expect(rotationFor(-1)).toBe(4);
    expect(rotationFor(-8)).toBe(-4);
  });

  it("rejects non-integer seeds", () => {
    expect(() => rotationFor(1.5)).toThrow(RangeError);
    expect(() => rotationFor(Number.NaN)).toThrow(RangeError);
  });

  it("random seeds are non-negative integers that fit a Postgres int", () => {
    const rng = seededRng(11);
    for (let i = 0; i < 100; i++) {
      const s = randomRotationSeed(rng);
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(ROTATION_SEED_MAX);
    }
    expect(Number.isInteger(randomRotationSeed())).toBe(true);
  });
});
