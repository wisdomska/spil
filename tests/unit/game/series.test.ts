import { describe, expect, it } from "vitest";
import { seriesScore } from "@/lib/game";

// SPIL-18: round wins by Mind Reader points across a series.
describe("seriesScore", () => {
  const row = (round: number, playerId: string, mindReader: number) => ({
    round,
    playerId,
    mindReader,
  });

  it("counts wins across three games", () => {
    const s = seriesScore([
      row(1, "ama", 40),
      row(1, "esi", 20),
      row(2, "ama", 10),
      row(2, "esi", 30),
      row(3, "ama", 50),
      row(3, "esi", 0),
    ]);
    expect(s.rounds).toBe(3);
    expect(Object.fromEntries(s.wins)).toEqual({ ama: 2, esi: 1 });
  });

  it("gives each tied player the win", () => {
    const s = seriesScore([row(1, "ama", 30), row(1, "esi", 30), row(1, "kofi", 10)]);
    expect(Object.fromEntries(s.wins)).toEqual({ ama: 1, esi: 1 });
  });

  it("a round nobody scored in has no winner", () => {
    const s = seriesScore([row(1, "ama", 0), row(1, "esi", 0)]);
    expect(s.rounds).toBe(1);
    expect(s.wins.size).toBe(0);
  });
});
