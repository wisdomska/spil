import { describe, expect, it } from "vitest";
import { cryptoRng, randomIndex, toMs, toMsOrNull } from "@/lib/game";

describe("time helpers", () => {
  it("normalizes numbers, ISO strings and Dates to epoch ms", () => {
    const ms = Date.UTC(2026, 9, 22);
    expect(toMs(ms)).toBe(ms);
    expect(toMs(new Date(ms).toISOString())).toBe(ms);
    expect(toMs(new Date(ms))).toBe(ms);
    expect(toMsOrNull(null)).toBeNull();
    expect(toMsOrNull(undefined)).toBeNull();
    expect(toMsOrNull(ms)).toBe(ms);
  });

  it("rejects invalid times", () => {
    expect(() => toMs("not a date")).toThrow(RangeError);
    expect(() => toMs(Number.NaN)).toThrow(RangeError);
  });
});

describe("rng helpers", () => {
  it("cryptoRng returns values in [0, 1)", () => {
    for (let i = 0; i < 1000; i++) {
      const v = cryptoRng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("randomIndex stays in range", () => {
    expect(randomIndex(() => 0, 5)).toBe(0);
    expect(randomIndex(() => 0.999, 5)).toBe(4);
    expect(randomIndex(() => 1, 5)).toBe(4);
    expect(randomIndex(() => -1, 5)).toBe(0);
    expect(randomIndex(() => Number.NaN, 5)).toBe(0);
  });
});
