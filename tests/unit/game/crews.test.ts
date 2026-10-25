import { describe, expect, it } from "vitest";
import { seasonKey, seasonTable } from "@/lib/game";

const round = (playedAt: string, scores: Array<[string, string, number, number]>) => ({
  playedAt,
  scores: scores.map(([userId, nickname, points, rank]) => ({ userId, nickname, points, rank })),
});

describe("crews and seasons", () => {
  const rounds = [
    round("2026-10-02T20:00:00Z", [
      ["u1", "Ama", 20, 1],
      ["u2", "Kofi", 10, 2],
      ["x", "Guest", 30, 1],
    ]),
    round("2026-10-20T20:00:00Z", [
      ["u1", "Ama B", 5, 2],
      ["u2", "Kofi", 25, 1],
    ]),
    round("2026-09-30T23:59:59Z", [["u1", "Ama", 100, 1]]),
  ];
  const members = new Set(["u1", "u2"]);

  it("keys seasons by calendar month in UTC", () => {
    expect(seasonKey("2026-10-31T23:59:59Z")).toBe("2026-10");
    expect(seasonKey("2026-11-01T00:00:00Z")).toBe("2026-11");
  });

  it("adds up members' points for the month only", () => {
    const table = seasonTable(rounds, members, "2026-10");
    expect(table).toEqual([
      { userId: "u2", nickname: "Kofi", points: 35, rounds: 2, wins: 1, place: 1 },
      { userId: "u1", nickname: "Ama B", points: 25, rounds: 2, wins: 1, place: 2 },
    ]);
  });

  it("leaves out people who are not in the crew and shares places on a tie", () => {
    const tie = seasonTable(
      [
        round("2026-10-05T10:00:00Z", [
          ["u1", "Ama", 10, 1],
          ["u2", "Kofi", 10, 1],
        ]),
      ],
      members,
      "2026-10",
    );
    expect(tie.map((r) => r.place)).toEqual([1, 1]);
    expect(seasonTable(rounds, members, "2026-10").some((r) => r.userId === "x")).toBe(false);
  });
});
