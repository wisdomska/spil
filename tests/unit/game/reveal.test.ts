import { describe, expect, it } from "vitest";
import { checkRevealNext, groupStep, REVEAL_MS, revealSlides, slideMinMs } from "@/lib/game";

describe("host-paced reveal (SPIL-11)", () => {
  it("one slide per tie group, then one per award", () => {
    expect(revealSlides(2, 1)).toEqual([
      { kind: "group", group: 0, last: false },
      { kind: "group", group: 1, last: true },
      { kind: "award", award: 0 },
    ]);
  });

  it("the room guess appears before the fill, and the rank only after the number lands", () => {
    const order = [0, 900, 2100, 3700, 4100].map((t) => groupStep(t, false).step);
    expect(order).toEqual(["intro", "guess", "fill", "stamp", "verdict"]);
    // The fill is still under way right up to its end: no stamp (rank) before the number lands.
    const endOfFill = REVEAL_MS.intro + REVEAL_MS.guess + REVEAL_MS.fill - 1;
    expect(groupStep(endOfFill, false).step).toBe("fill");
  });

  it("the top spiller beat runs before the last group when there is more than one", () => {
    expect(groupStep(100, true).step).toBe("beat");
    expect(groupStep(REVEAL_MS.topBeat + 100, true).step).toBe("intro");
  });

  it("a 2-player reveal cannot finish in under 10 seconds without Skip", () => {
    const slides = revealSlides(2, 0);
    const total = slides.reduce((sum, s) => sum + slideMinMs(s, 2), 0);
    expect(total).toBeGreaterThanOrEqual(10_000);
  });

  it("Next is refused too early, ignored when stale (double tap) or finished", () => {
    const slides = revealSlides(2, 0);
    const base = { slides, groups: 2 };
    expect(checkRevealNext({ ...base, index: 0, expected: 0, elapsedMs: 1000 })).toBe("too_early");
    expect(checkRevealNext({ ...base, index: 0, expected: 0, elapsedMs: 5300 })).toBe("ok");
    expect(checkRevealNext({ ...base, index: 1, expected: 0, elapsedMs: 9000 })).toBe("stale");
    expect(checkRevealNext({ ...base, index: 2, expected: 2, elapsedMs: 9000 })).toBe("done");
  });
});
