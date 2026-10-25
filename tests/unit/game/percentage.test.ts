import { describe, expect, it } from "vitest";
import { availableModes, modeMinPlayers, roomPercentResults } from "@/lib/game";
import { answers, player, questions } from "./fixtures";

const qs = questions(2);
// q0: 3 of 4 say yes (75 %). q1: 1 of 4 says yes (25 %).
const pattern: Record<string, ["yes" | "no", "yes" | "no"]> = {
  a: ["yes", "no"],
  b: ["yes", "yes"],
  c: ["yes", "no"],
  d: ["no", "no"],
};
const people = () =>
  Object.keys(pattern).map((id) =>
    player(id, id.toUpperCase(), { answers: answers(qs, (i) => pattern[id]![i]) }),
  );

describe("Room Percentage", () => {
  const guesses = { a: [75, 25], b: [70, 50], c: [50, 30], d: [100, 0] } as Record<
    string,
    [number, number]
  >;
  const r = roomPercentResults({
    questions: qs,
    players: people(),
    percentGuesses: Object.fromEntries(
      Object.entries(guesses).map(([id, [g0, g1]]) => [id, { [qs[0]!.id]: g0, [qs[1]!.id]: g1 }]),
    ),
  });

  it("works out the room's real yes share per question", () => {
    expect(r.percentQuestions.map((q) => q.actual)).toEqual([75, 25]);
  });

  it("scores each guess on the Mind Reader bands with the closest bonus", () => {
    const on = (qi: number, id: string) =>
      r.percentQuestions[qi]!.guesses.find((g) => g.playerId === id)!;
    expect(on(0, "a")).toMatchObject({ points: 13, closest: true }); // exact
    expect(on(0, "b")).toMatchObject({ points: 7, closest: false }); // 5 off
    expect(on(0, "d")).toMatchObject({ points: 0 }); // 25 off
    expect(on(1, "a")).toMatchObject({ points: 13, closest: true });
    expect(on(1, "c")).toMatchObject({ points: 7 }); // 5 off
  });

  it("ranks by points and sums them per player", () => {
    expect(r.rows[0]).toMatchObject({ playerId: "a", mindReader: 26, rank: 1, bullseyes: 2 });
    expect(r.rows.find((x) => x.playerId === "b")!.mindReader).toBe(7 + 0);
  });

  it("no room-guess awards in this mode", () => {
    expect(r.awards.map((a) => a.award)).not.toContain("dark_horse");
    expect(r.awards.map((a) => a.award)).not.toContain("open_book");
    expect(r.awards.map((a) => a.position)).toEqual(r.awards.map((_, i) => i + 1));
  });

  it("skips questions fewer than 3 people answered (privacy)", () => {
    const three = people().slice(0, 2);
    const small = roomPercentResults({ questions: qs, players: three, percentGuesses: {} });
    expect(small.percentQuestions).toEqual([]);
  });

  it("needs 3 players; classic still starts with 1", () => {
    expect(modeMinPlayers("room_percentage", 1)).toBe(3);
    expect(modeMinPlayers("classic", 1)).toBe(1);
    expect(modeMinPlayers("room_percentage", 5)).toBe(5);
    expect(availableModes(13)).toEqual([
      "classic",
      "room_percentage",
      "hot_takes",
      "most_likely",
      "red_green",
      "rank_room",
      "imposter",
      "two_truths",
      "spill_or_skip",
    ]);
  });
});
