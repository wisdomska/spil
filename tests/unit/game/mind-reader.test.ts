import { describe, expect, it } from "vitest";
import { computeResults, mindReaderPoints, verdictBand } from "@/lib/game";
import { answers, player, questions } from "./fixtures";

describe("Mind Reader points (SPIL-09)", () => {
  it("bands at 0, 5, 6, 10, 11, 20, 21", () => {
    expect([0, 5, 6, 10, 11, 20, 21].map(mindReaderPoints)).toEqual([10, 7, 5, 5, 2, 2, 0]);
  });

  it("playtest numbers: 9 off is 5, 15 off is 2, 20 off is 2, 30 off is 0", () => {
    expect([9, 15, 20, 30].map(mindReaderPoints)).toEqual([5, 2, 2, 0]);
  });

  it("a lazy 50 earns nothing for a score far from 50", () => {
    expect(mindReaderPoints(100 - 50)).toBe(0);
  });

  it("verdicts share the bands: within 5 well, within 15 a little, else none", () => {
    expect([0, 5, 6, 15, 16].map(verdictBand)).toEqual([
      "well",
      "well",
      "little",
      "little",
      "none",
    ]);
  });

  const qs = questions(4);
  const target = player("t", "Target", { answers: answers(qs, (i) => (i < 2 ? "yes" : "no")) }); // 50
  const guesser = (id: string, guess: number) =>
    player(id, id, { answers: answers(qs, () => "no"), guesses: { t: guess } });

  it("closest bonus: every guesser tied on the smallest miss gets +3", () => {
    const r = computeResults({
      questions: qs,
      players: [target, guesser("a", 55), guesser("b", 45), guesser("c", 70)],
    });
    const on = (id: string) => r.guessPoints.find((g) => g.guesserId === id && g.targetId === "t")!;
    expect(on("a")).toMatchObject({ points: 7 + 3, closest: true });
    expect(on("b")).toMatchObject({ points: 7 + 3, closest: true });
    expect(on("c")).toMatchObject({ points: 2, closest: false });
  });

  it("no closest bonus when fewer than 3 people guessed the target", () => {
    const r = computeResults({
      questions: qs,
      players: [target, guesser("a", 50), guesser("b", 60)],
    });
    expect(r.guessPoints.filter((g) => g.targetId === "t").map((g) => g.points)).toEqual([10, 5]);
    expect(r.guessPoints.every((g) => !g.closest)).toBe(true);
  });
});
