import { describe, expect, it } from "vitest";
import { hotTakesResults, modeFormat, modeMinPlayers, ratesStatements } from "@/lib/game";
import { player, questions } from "./fixtures";

const qs = questions(2);
// s0 ratings 80, 60, 40, 20 (average 50). s1 ratings 0, 0, 30, 100 (average 32.5, shown 33).
const ratings: Record<string, Record<string, number>> = {
  a: { q0: 80, q1: 0 },
  b: { q0: 60, q1: 0 },
  c: { q0: 40, q1: 30 },
  d: { q0: 20, q1: 100 },
};
const people = () => ["a", "b", "c", "d"].map((id) => player(id, id.toUpperCase()));

describe("Hot Takes", () => {
  const r = hotTakesResults({
    questions: qs,
    players: people(),
    ratings,
    percentGuesses: {
      a: { q0: 50, q1: 33 },
      b: { q0: 55, q1: 50 },
      c: { q0: 70, q1: 20 },
      d: { q0: 0, q1: 90 },
    },
  });

  it("works out the room's average rating per statement", () => {
    expect(r.percentQuestions.map((q) => q.actual)).toEqual([50, 33]);
    expect(r.percentQuestions.map((q) => q.answered)).toEqual([4, 4]);
  });

  it("scores guesses of the average like Room Percentage", () => {
    const on = (qi: number, id: string) =>
      r.percentQuestions[qi]!.guesses.find((g) => g.playerId === id)!;
    expect(on(0, "a")).toMatchObject({ points: 13, closest: true }); // exact
    expect(on(0, "b")).toMatchObject({ points: 7 }); // 5 off
    expect(on(1, "a")).toMatchObject({ points: 13, closest: true });
    expect(r.rows[0]).toMatchObject({ playerId: "a", mindReader: 26, rank: 1 });
  });

  it("names each player's hottest take: the rating furthest from the room", () => {
    expect(r.hottest.d).toEqual({
      questionId: "q1",
      text: "question 1?",
      rating: 100,
      average: 33,
    });
    expect(r.hottest.a).toMatchObject({ questionId: "q1", rating: 0 }); // 33 off beats 30 off
  });

  it("only gives the awards about reading the room", () => {
    for (const a of r.awards) expect(["mind_reader", "clueless"]).toContain(a.award);
  });

  it("skips statements fewer than 3 people rated (privacy)", () => {
    const small = hotTakesResults({
      questions: qs,
      players: people(),
      ratings: { a: { q0: 10 }, b: { q0: 90, q1: 50 }, c: { q1: 50 } },
      percentGuesses: {},
    });
    expect(small.percentQuestions).toEqual([]);
    expect(small.hottest).toEqual({});
  });

  it("plays statement packs and needs 3 players", () => {
    expect(ratesStatements("hot_takes")).toBe(true);
    expect(modeFormat("hot_takes")).toBe("statements");
    expect(modeFormat("room_percentage")).toBe("yes_no");
    expect(modeMinPlayers("hot_takes", 1)).toBe(3);
  });
});
