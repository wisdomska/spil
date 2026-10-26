import { describe, expect, it } from "vitest";
import { dailyShare, dayKey, dayNumber, nextStreak, pickDaily, streakFromDays } from "@/lib/game";

describe("Daily Spill", () => {
  it("runs on UTC days", () => {
    expect(dayKey(Date.parse("2026-10-25T23:59:59Z"))).toBe("2026-10-25");
    expect(dayKey(Date.parse("2026-10-26T00:00:00Z"))).toBe("2026-10-26");
    expect(dayNumber("1970-01-02")).toBe(1);
  });

  it("walks the questions one a day without repeats", () => {
    const ids = ["c", "a", "b"];
    const days = ["2026-10-25", "2026-10-26", "2026-10-27"].map((d) => pickDaily(ids, d));
    expect(new Set(days).size).toBe(3);
    expect(pickDaily(ids, "2026-10-28")).toBe(days[0]);
    expect(pickDaily([], "2026-10-25")).toBeNull();
  });

  it("shows the share only once enough people answered", () => {
    expect(dailyShare(3, 9)).toBeNull();
    expect(dailyShare(4, 10)).toBe(40);
  });

  it("keeps a streak for answers on back to back days", () => {
    const one = nextStreak(null, "2026-10-25");
    expect(one).toEqual({ last: "2026-10-25", days: 1 });
    expect(nextStreak(one, "2026-10-25")).toEqual(one);
    expect(nextStreak(one, "2026-10-26")).toEqual({ last: "2026-10-26", days: 2 });
    expect(nextStreak({ last: "2026-10-26", days: 2 }, "2026-10-28")).toEqual({
      last: "2026-10-28",
      days: 1,
    });
  });
});

describe("streak from answered days", () => {
  it("counts days in a row ending today", () => {
    expect(
      streakFromDays(["2026-10-26", "2026-10-25", "2026-10-24", "2026-10-20"], "2026-10-26"),
    ).toBe(3);
    expect(streakFromDays(["2026-10-25", "2026-10-24"], "2026-10-26")).toBe(0);
    expect(streakFromDays([], "2026-10-26")).toBe(0);
    // Across a month end.
    expect(streakFromDays(["2026-11-01", "2026-10-31"], "2026-11-01")).toBe(2);
  });
});
