import { describe, expect, it } from "vitest";
import { duoResult } from "@/lib/game";

// SPIL-23: two players get a percentage and one duo award.
const p = (playerId: string, score: number, avgGuessAbout: number, guessedBy = 1) => ({
  playerId,
  score,
  avgGuessAbout,
  guessedBy,
});

describe("duoResult", () => {
  it("both within 5 are soulmates", () => {
    expect(duoResult([p("a", 60, 55), p("b", 20, 25)])).toEqual({
      pct: 95,
      award: "soulmates",
      errors: [5, 5],
    });
  });
  it("both within 15 are getting there", () => {
    expect(duoResult([p("a", 60, 50), p("b", 20, 35)])?.award).toBe("getting_there");
  });
  it("anything wider is a work in progress, and the percentage never goes below 0", () => {
    const r = duoResult([p("a", 100, 0), p("b", 0, 100)]);
    expect(r).toMatchObject({ award: "work_in_progress", pct: 0 });
  });
  it("needs exactly two players who were both guessed", () => {
    expect(duoResult([p("a", 50, 50)])).toBeNull();
    expect(duoResult([p("a", 50, 50), p("b", 50, 50), p("c", 50, 50)])).toBeNull();
    expect(duoResult([p("a", 50, 50), p("b", 50, 0, 0)])).toBeNull();
  });
});
