import { describe, expect, it } from "vitest";
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  CODE_PATTERN,
  generateCode,
  generateUniqueCode,
  isValidCode,
  normalizeCode,
} from "@/lib/game";
import { seededRng, sequenceRng } from "./fixtures";

describe("codes", () => {
  it("alphabet has 32 characters and no ambiguous ones", () => {
    expect(CODE_ALPHABET).toHaveLength(32);
    expect(new Set(CODE_ALPHABET).size).toBe(32);
    for (const c of "IO01") expect(CODE_ALPHABET).not.toContain(c);
  });

  it("generates 4-character codes from the alphabet with crypto randomness", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateCode();
      expect(code).toHaveLength(CODE_LENGTH);
      expect(code).toMatch(CODE_PATTERN);
    }
  });

  it("is deterministic with an injected RNG", () => {
    expect(generateCode(seededRng(7))).toBe(generateCode(seededRng(7)));
    expect(generateCode(sequenceRng([0]))).toBe("AAAA");
    expect(generateCode(sequenceRng([0.999999]))).toBe("9999");
  });

  it("clamps a misbehaving RNG into range", () => {
    expect(generateCode(() => 1)).toBe("9999");
    expect(generateCode(() => -0.5)).toBe("AAAA");
    expect(generateCode(() => Number.NaN)).toBe("AAAA");
  });

  it("covers the whole alphabet", () => {
    const rng = seededRng(42);
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) for (const c of generateCode(rng)) seen.add(c);
    expect(seen.size).toBe(32);
  });

  it("validates and normalizes codes", () => {
    expect(isValidCode("K7QX")).toBe(true);
    expect(isValidCode("k7qx")).toBe(false);
    expect(isValidCode("K7Q")).toBe(false);
    expect(isValidCode("K7QXZ")).toBe(false);
    expect(isValidCode("KOQX")).toBe(false);
    expect(isValidCode("K1QX")).toBe(false);
    expect(normalizeCode("  k7qx ")).toBe("K7QX");
  });

  it("retries on collision with a live room", () => {
    const taken = new Set(["AAAA", "BBBB"]);
    const rng = sequenceRng([
      ...Array(4).fill(0),
      ...Array(4).fill(1 / 32),
      ...Array(4).fill(2 / 32),
    ]);
    expect(generateUniqueCode((c) => taken.has(c), { rng })).toBe("CCCC");
  });

  it("gives up after maxAttempts collisions", () => {
    expect(() => generateUniqueCode(() => true, { maxAttempts: 3 })).toThrow(/3 attempts/);
  });

  it("uses crypto randomness by default", () => {
    expect(generateUniqueCode(() => false)).toMatch(CODE_PATTERN);
  });
});
