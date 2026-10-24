import { describe, expect, it } from "vitest";
import {
  modeFormat,
  modeMinPlayers,
  rankPoints,
  rankRoomResults,
  ranksPlayers,
  skipsGuessing,
  startingOrder,
} from "@/lib/game";
import { player, questions } from "./fixtures";

const qs = questions(1);
const people = () => ["a", "b", "c"].map((id) => player(id, id.toUpperCase()));

describe("Rank the Room", () => {
  // a and b put the room in order a, b, c; c puts it c, b, a.
  const r = rankRoomResults({
    questions: qs,
    players: people(),
    ranks: {
      a: { q0: ["a", "b", "c"] },
      b: { q0: ["a", "b", "c"] },
      c: { q0: ["c", "b", "a"] },
    },
  });

  it("orders the room by average position", () => {
    expect(r.ranked[0]!.order).toEqual([
      { playerId: "a", average: 1.67, place: 1 },
      { playerId: "b", average: 2, place: 2 },
      { playerId: "c", average: 2.33, place: 3 },
    ]);
  });

  it("scores each ranking by how close it is to the room's order", () => {
    const pts = Object.fromEntries(r.rows.map((x) => [x.playerId, x.mindReader]));
    // Distance 0.67 + 0 + 0.67 of a furthest 4: 7 points. Reversed: 2.67 of 4: 3 points.
    expect(pts).toEqual({ a: 7, b: 7, c: 3 });
    expect(
      rankPoints(
        ["a", "b", "c"],
        [
          { playerId: "a", average: 1, place: 1 },
          { playerId: "b", average: 2, place: 2 },
          { playerId: "c", average: 3, place: 3 },
        ],
      ),
    ).toBe(10);
  });

  it("names each player's highest place", () => {
    expect(r.best.a).toEqual({ questionId: "q0", text: "question 0?", place: 1 });
    expect(r.best.c).toMatchObject({ place: 3 });
  });

  it("shares a place on equal averages and ignores players who are not in the room", () => {
    // b and c swap places between rankers, so they share second place.
    const four = [...people(), player("d", "D")];
    const tie = rankRoomResults({
      questions: qs,
      players: four,
      ranks: {
        a: { q0: ["a", "b", "c", "d", "ghost"] },
        b: { q0: ["a", "c", "b", "d"] },
        c: { q0: ["a", "b", "c", "d"] },
        d: { q0: ["a", "c", "b", "d"] },
      },
    });
    expect(tie.ranked[0]!.order.map((p) => [p.playerId, p.place])).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 2],
      ["d", 4],
    ]);
  });

  it("needs 3 rankings per prompt", () => {
    const small = rankRoomResults({
      questions: qs,
      players: people(),
      ranks: { a: { q0: ["a", "b", "c"] }, b: { q0: ["a", "b", "c"] } },
    });
    expect(small.ranked).toEqual([]);
  });

  it("starts every phone from the same shuffle for a prompt", () => {
    const list = ["a", "b", "c", "d", "e"].map((id) => ({ id }));
    const one = startingOrder(list, "q0").map((p) => p.id);
    expect(startingOrder(list, "q0").map((p) => p.id)).toEqual(one);
    expect([...one].sort()).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("plays prompt packs, needs 3 players and skips guessing", () => {
    expect(ranksPlayers("rank_room")).toBe(true);
    expect(modeFormat("rank_room")).toBe("prompts");
    expect(skipsGuessing("rank_room")).toBe(true);
    expect(modeMinPlayers("rank_room", 1)).toBe(3);
  });
});
