import { describe, expect, it } from "vitest";
import { achievements, EMPTY_STATS, isFrame, roundStats, unlocked } from "@/lib/game";

describe("achievements and cosmetics", () => {
  it("starts with nothing unlocked but the defaults", () => {
    const states = achievements(EMPTY_STATS);
    expect(states.every((s) => !s.unlocked && s.progress === 0)).toBe(true);
    expect(unlocked(states)).toEqual({ frames: ["none"], looks: ["night"] });
  });

  it("unlocks badges at their targets and caps progress", () => {
    const states = achievements({ ...EMPTY_STATS, games: 12, wins: 1, bullseyes: 3, modes: 5 });
    const by = Object.fromEntries(states.map((s) => [s.id, s]));
    expect(by.first_spill!.unlocked).toBe(true);
    expect(by.regular!.unlocked).toBe(true);
    expect(by.veteran).toMatchObject({ unlocked: false, progress: 12, target: 50 });
    expect(by.sharpshooter).toMatchObject({ progress: 3, target: 10 });
    expect(unlocked(states)).toEqual({
      frames: ["none", "ring", "accent", "dashed"],
      looks: ["night", "raised"],
    });
  });

  it("counts a win only with someone to beat and some points", () => {
    expect(roundStats({ rank: 1, points: 20, bullseyes: 1, hosted: true, players: 3 })).toEqual({
      games: 1,
      wins: 1,
      bullseyes: 1,
      hosted: 1,
      points: 20,
    });
    expect(roundStats({ rank: 1, points: 0, bullseyes: 0, hosted: false, players: 1 }).wins).toBe(
      0,
    );
  });

  it("knows its frames", () => {
    expect(isFrame("double")).toBe(true);
    expect(isFrame("rainbow")).toBe(false);
  });
});
