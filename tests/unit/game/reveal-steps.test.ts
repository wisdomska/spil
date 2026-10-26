import { describe, expect, it } from "vitest";
import {
  avatarKey,
  isReaction,
  MAX_FLOATING,
  questionStep,
  REACTIONS,
  REVEAL_MS,
  revealSlides,
  slideMinMs,
} from "@/lib/game";

// Room Percentage reveal steps, slide lengths, reactions and the avatar name fallback.
describe("question slides (Room Percentage)", () => {
  it("builds one slide per scored question, then awards", () => {
    expect(revealSlides(2, 1, "question")).toEqual([
      { kind: "question", question: 0 },
      { kind: "question", question: 1 },
      { kind: "award", award: 0 },
    ]);
  });

  it("walks intro, fill, stamp and verdict", () => {
    expect(questionStep(-50)).toEqual({ step: "intro", fill: 0 });
    expect(questionStep(REVEAL_MS.intro + REVEAL_MS.fill / 2)).toEqual({ step: "fill", fill: 0.5 });
    expect(questionStep(REVEAL_MS.intro + REVEAL_MS.fill)).toEqual({ step: "stamp", fill: 1 });
    expect(questionStep(REVEAL_MS.intro + REVEAL_MS.fill + REVEAL_MS.stamp)).toEqual({
      step: "verdict",
      fill: 1,
    });
  });

  it("holds each kind of slide long enough to read", () => {
    expect(slideMinMs({ kind: "question", question: 0 }, 1)).toBe(
      REVEAL_MS.intro + REVEAL_MS.fill + REVEAL_MS.stamp + REVEAL_MS.verdict,
    );
    expect(slideMinMs({ kind: "award", award: 0 }, 1)).toBe(
      REVEAL_MS.awardBeat + REVEAL_MS.awardHold,
    );
  });
});

describe("reactions", () => {
  it("accepts only the fixed emoji", () => {
    for (const r of REACTIONS) expect(isReaction(r)).toBe(true);
    expect(isReaction("🍕")).toBe(false);
    expect(isReaction(3)).toBe(false);
    expect(MAX_FLOATING).toBeGreaterThan(0);
  });
});

describe("avatar names", () => {
  it("falls back to the first face for an unknown index", () => {
    expect(avatarKey(99)).toBe("devil");
    expect(avatarKey(-1)).toBe("devil");
  });
});
