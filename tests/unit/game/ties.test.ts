import { describe, expect, it } from "vitest";
import { isTiedRank, rankByGuessing, spillGroups, spillTies } from "@/lib/game";

const row = (playerId: string, score: number, mindReader = 50) => ({ playerId, score, mindReader });

describe("ties (SPIL-04)", () => {
  it("LXQT: two players on 40 are one reveal step, tied for most spilled", () => {
    const groups = spillGroups([row("esi", 40), row("ama", 40)]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ score: 40, place: 1 });
    expect(groups[0]!.rows.map((r) => r.playerId)).toEqual(["esi", "ama"]);
  });

  it("groups run lowest score first and places skip after a tie", () => {
    const groups = spillGroups([row("a", 80), row("b", 80), row("c", 30), row("d", 55)]);
    expect(groups.map((g) => [g.score, g.place, g.rows.length])).toEqual([
      [30, 4, 1],
      [55, 3, 1],
      [80, 1, 2],
    ]);
  });

  it("a tie in the middle shares its place", () => {
    const groups = spillGroups([row("a", 90), row("b", 50), row("c", 50), row("d", 10)]);
    expect(groups.map((g) => g.place)).toEqual([4, 2, 1]);
  });

  it("spillTies gives each player their place and who they share it with", () => {
    const ties = spillTies([row("a", 40), row("b", 40), row("c", 20)]);
    expect(ties.get("a")).toEqual({ spillRank: 1, tiedWith: ["b"] });
    expect(ties.get("b")).toEqual({ spillRank: 1, tiedWith: ["a"] });
    expect(ties.get("c")).toEqual({ spillRank: 3, tiedWith: [] });
  });

  it("results list marks shared ranks: T1, T1, 3", () => {
    const ranked = rankByGuessing([row("a", 10, 80), row("b", 90, 80), row("c", 50, 60)]);
    const ranks = ranked.map((r) => r.rank);
    expect(ranks).toEqual([1, 1, 3]);
    expect(ranks.map((r) => isTiedRank(r, ranks))).toEqual([true, true, false]);
  });

  it("nobody tied: every step has one player", () => {
    const groups = spillGroups([row("a", 1), row("b", 2), row("c", 3)]);
    expect(groups.every((g) => g.rows.length === 1)).toBe(true);
    expect(groups.map((g) => g.place)).toEqual([3, 2, 1]);
  });
});
