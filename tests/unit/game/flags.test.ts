import { describe, expect, it } from "vitest";
import {
  answersYesNo,
  flagResults,
  modeFormat,
  modeMinPlayers,
  skipsGuessing,
  swipesFlags,
} from "@/lib/game";
import { answers, player, questions } from "./fixtures";

const qs = questions(3);
// q0: green 3, red 1. q1: green 1, red 3. q2: 2 and 2 (split).
const swipes: Record<string, string> = { a: "YNY", b: "YNN", c: "YNY", d: "NYN" };
const people = () =>
  Object.keys(swipes).map((id) =>
    player(id, id.toUpperCase(), {
      answers: answers(qs, (i) => (swipes[id]![i] === "Y" ? "yes" : "no")),
    }),
  );

describe("Red Flag, Green Flag", () => {
  const r = flagResults({ questions: qs, players: people() });

  it("works out each scenario's split and verdict", () => {
    expect(r.flags.map((f) => [f.green, f.red, f.greenShare, f.verdict])).toEqual([
      [3, 1, 75, "green"],
      [1, 3, 25, "red"],
      [2, 2, 50, "split"],
    ]);
  });

  it("gives points for answers on the room's side, none for a split", () => {
    const pts = Object.fromEntries(r.rows.map((x) => [x.playerId, x.mindReader]));
    expect(pts).toEqual({ a: 20, b: 20, c: 20, d: 0 });
    expect(r.rows.find((x) => x.playerId === "d")!.rank).toBe(4);
  });

  it("finds the scenario each player was most outnumbered on", () => {
    expect(r.lone.d).toEqual({ questionId: "q0", text: "question 0?", side: "red", against: 75 });
    expect(r.lone.a).toBeUndefined();
  });

  it("skips scenarios fewer than 3 people answered (privacy)", () => {
    const small = flagResults({ questions: qs, players: people().slice(0, 2) });
    expect(small.flags).toEqual([]);
  });

  it("plays flag packs on the yes or no swipe, with no guessing", () => {
    expect(swipesFlags("red_green")).toBe(true);
    expect(modeFormat("red_green")).toBe("flags");
    expect(answersYesNo("red_green")).toBe(true);
    expect(answersYesNo("hot_takes")).toBe(false);
    expect(skipsGuessing("red_green")).toBe(true);
    expect(skipsGuessing("room_percentage")).toBe(false);
    expect(modeMinPlayers("red_green", 1)).toBe(3);
  });
});
