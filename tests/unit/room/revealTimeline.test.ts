import { describe, expect, it } from "vitest";
import { BEATS, frameAt, revealDuration } from "@/lib/room/revealTimeline";

const scores = [9, 41, 88];

describe("reveal timeline", () => {
  it("starts with the 700 ms intro on the lowest score", () => {
    expect(frameAt(0, scores, 6)).toEqual({ phase: "intro", player: 0, count: 0 });
    expect(frameAt(699, scores, 6).phase).toBe("intro");
  });

  it("counts up with ease-out, integer steps, ending on the score", () => {
    const mid = frameAt(BEATS.intro + BEATS.count / 2, scores, 6);
    expect(mid.phase).toBe("count");
    if (mid.phase === "count") {
      expect(Number.isInteger(mid.count)).toBe(true);
      expect(mid.count).toBeGreaterThan(9 / 2); // ease-out is past halfway at half time
    }
    expect(frameAt(BEATS.intro + BEATS.count + 10, scores, 6)).toEqual({
      phase: "count",
      player: 0,
      count: 9,
    });
  });

  it("slaps the label after the 150 ms beat and holds it", () => {
    const t = BEATS.intro + BEATS.count + BEATS.toLabel + 1;
    expect(frameAt(t, scores, 6)).toEqual({ phase: "label", player: 0, count: 9 });
  });

  it("moves to the next player after a 450 ms gap", () => {
    const end0 = BEATS.intro + BEATS.count + BEATS.toLabel + BEATS.hold;
    expect(frameAt(end0 + 1, scores, 6)).toEqual({ phase: "intro", player: 1, count: 0 });
    expect(frameAt(end0 + BEATS.gap + 1, scores, 6).phase).toBe("count");
  });

  it("then shows six awards, each a beat and a hold, then finishes", () => {
    const players = BEATS.intro + 3 * (BEATS.count + BEATS.toLabel + BEATS.hold) + 2 * BEATS.gap;
    expect(frameAt(players + 1, scores, 6)).toEqual({ phase: "beat", award: 0 });
    expect(frameAt(players + BEATS.awardBeat + 1, scores, 6)).toEqual({ phase: "award", award: 0 });
    expect(frameAt(revealDuration(3, 6) + 1, scores, 6)).toEqual({ phase: "done" });
  });

  it("lasts about 33 to 38 s for 7 players (HANDOFF)", () => {
    const ms = revealDuration(7, 6);
    expect(ms).toBeGreaterThan(33_000);
    expect(ms).toBeLessThan(38_000);
  });

  it("reduced motion shows the final score at once but keeps the beats", () => {
    const f = frameAt(BEATS.intro + 10, scores, 6, true);
    expect(f).toEqual({ phase: "count", player: 0, count: 9 });
    expect(revealDuration(3, 6)).toBeGreaterThan(0);
  });

  it("an empty room is done immediately", () => {
    expect(frameAt(0, [], 6)).toEqual({ phase: "done" });
    expect(revealDuration(0, 6)).toBe(0);
  });
});
