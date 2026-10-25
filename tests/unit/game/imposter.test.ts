import { describe, expect, it } from "vitest";
import {
  answersWithRatings,
  hasImposter,
  imposterBoard,
  imposterResults,
  modeFormat,
  modeMinPlayers,
  skipsGuessing,
} from "@/lib/game";
import { player, questions } from "./fixtures";

const qs = questions(2);
const people = () => ["a", "b", "c", "d"].map((id) => player(id, id.toUpperCase()));
const base = {
  questions: qs,
  ratings: {
    a: { q0: 80, q1: 70 },
    b: { q0: 75, q1: 65 },
    c: { q0: 10, q1: 90 },
    d: { q0: 85 },
  },
  altText: { q0: "alt 0?", q1: "alt 1?" },
  imposterId: "c",
};

describe("Imposter", () => {
  it("catches the imposter when they alone have the most votes", () => {
    const r = imposterResults({
      ...base,
      players: people(),
      suspects: { a: "c", b: "c", c: "a", d: "b" },
    });
    expect(r.imposter).toMatchObject({ caught: true, top: ["c"], voters: 4 });
    const pts = Object.fromEntries(r.rows.map((x) => [x.playerId, x.mindReader]));
    expect(pts).toEqual({ a: 10, b: 10, c: 0, d: 0 });
  });

  it("lets the imposter escape on a tie or a wrong pick", () => {
    const tie = imposterResults({
      ...base,
      players: people(),
      suspects: { a: "c", b: "d", c: "d", d: "c" },
    });
    expect(tie.imposter).toMatchObject({ caught: false, top: ["c", "d"] });
    const pts = Object.fromEntries(tie.rows.map((x) => [x.playerId, x.mindReader]));
    expect(pts).toEqual({ a: 10, b: 0, c: 20, d: 10 });
    expect(tie.rows[0]!.playerId).toBe("c");
  });

  it("ignores votes for yourself", () => {
    const r = imposterResults({ ...base, players: people(), suspects: { a: "a", b: "c" } });
    expect(r.imposter.voters).toBe(1);
  });

  it("shows each question with everyone's numbers and the imposter's question", () => {
    const board = imposterBoard({ ...base, players: people() });
    expect(board[0]).toEqual({
      questionId: "q0",
      text: "question 0?",
      altText: "alt 0?",
      answers: [
        { playerId: "a", value: 80 },
        { playerId: "b", value: 75 },
        { playerId: "c", value: 10 },
        { playerId: "d", value: 85 },
      ],
    });
    expect(board[1]!.answers).toHaveLength(3);
  });

  it("plays pairs packs with ratings and a voting phase", () => {
    expect(hasImposter("imposter")).toBe(true);
    expect(modeFormat("imposter")).toBe("pairs");
    expect(answersWithRatings("imposter")).toBe(true);
    expect(answersWithRatings("hot_takes")).toBe(true);
    expect(skipsGuessing("imposter")).toBe(false);
    expect(modeMinPlayers("imposter", 1)).toBe(3);
  });
});
