import { describe, expect, it } from "vitest";
import {
  SKIP_LIMIT_RATIO,
  checkAnswerSubmission,
  scoreForRound,
  skipLimit,
  skipsLeft,
  spillScore,
  tallyAnswers,
  type AnswerValue,
} from "@/lib/game";

const many = (yes: number, no: number, skip = 0): AnswerValue[] => [
  ...Array<AnswerValue>(yes).fill("yes"),
  ...Array<AnswerValue>(no).fill("no"),
  ...Array<AnswerValue>(skip).fill("skip"),
];

describe("spillScore", () => {
  it("is round(100 * yes / (yes + no))", () => {
    expect(spillScore(many(9, 3))).toBe(75);
    expect(spillScore(many(1, 2))).toBe(33);
    expect(spillScore(many(2, 1))).toBe(67);
    expect(spillScore(many(1, 7))).toBe(13);
    expect(spillScore(many(12, 0))).toBe(100);
    expect(spillScore(many(0, 12))).toBe(0);
  });

  it("rounds half up", () => {
    expect(spillScore(many(1, 7))).toBe(Math.round(12.5));
    expect(spillScore(many(1, 7))).toBe(13);
  });

  it("excludes skips from the denominator", () => {
    expect(spillScore(many(5, 6, 1))).toBe(Math.round((5 / 11) * 100));
    expect(spillScore(many(5, 6, 1))).toBe(45);
  });

  it("is 0 when nothing was answered", () => {
    expect(spillScore([])).toBe(0);
    expect(spillScore(many(0, 0, 4))).toBe(0);
    expect(spillScore([null, undefined])).toBe(0);
  });

  it("tallies values and ignores missing ones", () => {
    expect(tallyAnswers(["yes", "no", "skip", null, undefined, "yes"])).toEqual({
      yes: 2,
      no: 1,
      skip: 1,
    });
  });

  it("scores only this round's questions", () => {
    const a: Record<string, AnswerValue> = { q1: "yes", q2: "no", old: "yes" };
    expect(scoreForRound(a, ["q1", "q2"])).toBe(50);
    expect(scoreForRound(a, ["q1", "q2", "q3"])).toBe(50);
  });
});

describe("skip limit", () => {
  it("is 10% of the round's questions, at least 1", () => {
    expect(SKIP_LIMIT_RATIO).toBe(0.1);
    expect(skipLimit(0)).toBe(0);
    expect(skipLimit(5)).toBe(1);
    expect(skipLimit(9)).toBe(1);
    expect(skipLimit(12)).toBe(1);
    expect(skipLimit(20)).toBe(2);
    expect(skipLimit(29)).toBe(2);
    expect(skipLimit(100)).toBe(10);
  });

  it("counts down the skips left (SPIL-20)", () => {
    expect(skipsLeft([], 20)).toBe(2);
    expect(skipsLeft(["yes", "skip"], 20)).toBe(1);
    expect(skipsLeft(["skip", "skip", "skip"], 20)).toBe(0);
    expect(skipsLeft([], 0)).toBe(0);
  });
});

describe("checkAnswerSubmission", () => {
  const ids = Array.from({ length: 12 }, (_, i) => `q${i}`);
  const full = (pick: (i: number) => AnswerValue) =>
    Object.fromEntries(ids.map((id, i) => [id, pick(i)]));

  it("accepts a complete set within the skip limit", () => {
    expect(
      checkAnswerSubmission(
        full(() => "yes"),
        ids,
      ),
    ).toEqual({ ok: true });
    expect(
      checkAnswerSubmission(
        full((i) => (i === 0 ? "skip" : "no")),
        ids,
      ),
    ).toEqual({ ok: true });
  });

  it("rejects missing answers", () => {
    const a = full(() => "yes");
    delete a.q3;
    expect(checkAnswerSubmission(a, ids)).toEqual({ ok: false, code: "INCOMPLETE" });
  });

  it("rejects too many skips", () => {
    expect(
      checkAnswerSubmission(
        full((i) => (i < 2 ? "skip" : "yes")),
        ids,
      ),
    ).toEqual({
      ok: false,
      code: "SKIP_LIMIT",
    });
  });

  it("rejects answers to questions outside the round", () => {
    expect(checkAnswerSubmission({ ...full(() => "no"), other: "yes" }, ids)).toEqual({
      ok: false,
      code: "UNKNOWN_QUESTION",
    });
  });
});
