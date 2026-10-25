import { describe, expect, it } from "vitest";
import {
  canMakeCard,
  modeFormat,
  picksTruths,
  truthsCards,
  twoTruthsResults,
  validPick,
} from "@/lib/game";
import { answers, player, questions } from "./fixtures";

const qs = questions(4);
// Everyone: q0 yes, q1 yes, q2 no, q3 yes.
const yesNo = (i: number) => (i === 2 ? "no" : "yes");
const people = () =>
  ["a", "b", "c"].map((id) => player(id, id.toUpperCase(), { answers: answers(qs, yesNo) }));
const picks = {
  a: { truths: ["q0", "q1"], spill: "q2" },
  b: { truths: ["q0", "q3"], spill: "q2" },
};

describe("Two Truths and a Spill", () => {
  const r = twoTruthsResults({
    questions: qs,
    players: people(),
    picks,
    seed: "r1",
    // b and c spot a's spill; a falls for b's q0, c spots b's spill.
    spots: { b: { a: "q2" }, c: { a: "q2", b: "q2" }, a: { b: "q0" } },
  });

  it("checks a card against the player's own answers", () => {
    const mine = answers(qs, yesNo);
    expect(validPick(mine, { truths: ["q0", "q1"], spill: "q2" })).toBe(true);
    expect(validPick(mine, { truths: ["q0", "q2"], spill: "q1" })).toBe(false);
    expect(validPick(mine, { truths: ["q0", "q0"], spill: "q2" })).toBe(false);
    expect(canMakeCard(mine)).toBe(true);
    expect(canMakeCard(answers(qs, () => "yes"))).toBe(false);
  });

  it("shows only valid cards, shuffled, and never marks the spill", () => {
    const cards = truthsCards({ questions: qs, players: people(), picks, seed: "r1" });
    expect(cards.map((c) => c.playerId)).toEqual(["a", "b"]);
    expect(cards[0]!.items.map((i) => i.questionId).sort()).toEqual(["q0", "q1", "q2"]);
    expect(JSON.stringify(cards)).not.toContain("spill");
  });

  it("scores spotting the spill and fooling the room", () => {
    const pts = Object.fromEntries(r.rows.map((x) => [x.playerId, x.mindReader]));
    // b: spotted a (10). c: spotted a and b (20). a: fooled by b, nobody fooled by a (0).
    // b's card fooled a: +5 for b.
    expect(pts).toEqual({ a: 0, b: 15, c: 20 });
    expect(r.cards[1]).toMatchObject({ playerId: "b", spill: "q2", guessers: 2, fooled: 1 });
    expect(r.cards[1]!.spotted).toEqual({ q0: 1, q3: 0, q2: 1 });
  });

  it("plays yes or no packs", () => {
    expect(picksTruths("two_truths")).toBe(true);
    expect(modeFormat("two_truths")).toBe("yes_no");
  });
});
