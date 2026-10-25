import { describe, expect, it } from "vitest";
import { isSpillOption, playsClassic, spillOptions, tallySpill, votesForStory } from "@/lib/game";
import { answers, player, questions } from "./fixtures";

const qs = questions(2);
const people = () => [
  player("a", "A", { spillMode: true, answers: answers(qs, (i) => (i === 0 ? "yes" : "no")) }),
  player("b", "B", { spillMode: false, answers: answers(qs, () => "yes") }),
  player("c", "C", { spillMode: true, answers: answers(qs, () => "yes") }),
];

describe("Spill or Skip", () => {
  const options = spillOptions(qs, people());

  it("offers only yeses from players in Spill Mode", () => {
    expect(options.map((o) => `${o.playerId}:${o.questionId}`)).toEqual(["a:q0", "c:q0", "c:q1"]);
    expect(isSpillOption(options, { questionId: "q1", playerId: "b" })).toBe(false);
    expect(isSpillOption(options, "skip")).toBe(true);
  });

  it("picks the story with the most votes when it beats Skip", () => {
    const t = tallySpill(options, {
      a: { questionId: "q1", playerId: "c" },
      b: { questionId: "q1", playerId: "c" },
      c: "skip",
    });
    expect(t).toMatchObject({ voters: 3, skips: 1, pick: { questionId: "q1", playerId: "c" } });
  });

  it("picks nothing on a tie or when Skip wins, and ignores invalid votes", () => {
    expect(
      tallySpill(options, {
        a: { questionId: "q0", playerId: "c" },
        b: { questionId: "q1", playerId: "c" },
      }).pick,
    ).toBeNull();
    expect(
      tallySpill(options, { a: { questionId: "q0", playerId: "c" }, b: "skip", c: "skip" }).pick,
    ).toBeNull();
    expect(tallySpill(options, { a: { questionId: "q1", playerId: "b" } }).voters).toBe(0);
  });

  it("plays the classic round", () => {
    expect(votesForStory("spill_or_skip")).toBe(true);
    expect(playsClassic("spill_or_skip")).toBe(true);
    expect(playsClassic("classic")).toBe(true);
    expect(playsClassic("hot_takes")).toBe(false);
  });
});
