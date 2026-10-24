import { describe, expect, it } from "vitest";
import { modeFormat, modeMinPlayers, mostLikelyResults, votesForPlayers } from "@/lib/game";
import { player, questions } from "./fixtures";

const qs = questions(2);
const people = () => ["a", "b", "c", "d"].map((id) => player(id, id.toUpperCase()));

describe("Most Likely To", () => {
  // q0: b gets 3 votes, a gets 1 (b voted a). q1: a and c tie on 2.
  const r = mostLikelyResults({
    questions: qs,
    players: people(),
    votes: {
      a: { q0: "b", q1: "c" },
      b: { q0: "a", q1: "a" },
      c: { q0: "b", q1: "a" },
      d: { q0: "b", q1: "c" },
    },
  });

  it("tallies votes per prompt, most first, and names the room's pick", () => {
    expect(r.likely[0]).toMatchObject({
      voters: 4,
      top: ["b"],
      tally: [
        { playerId: "b", count: 3 },
        { playerId: "a", count: 1 },
      ],
    });
    expect(r.likely[1]!.top).toEqual(["a", "c"]);
  });

  it("gives points for every vote that matched the room's pick, ties included", () => {
    const pts = Object.fromEntries(r.rows.map((x) => [x.playerId, x.mindReader]));
    expect(pts).toEqual({ a: 20, b: 10, c: 20, d: 20 });
    expect(r.rows.find((x) => x.playerId === "b")!.rank).toBe(4);
  });

  it("crowns each player's strongest pick", () => {
    expect(r.crowned.b).toEqual({ questionId: "q0", text: "question 0?", count: 3, voters: 4 });
    expect(r.crowned.a).toMatchObject({ questionId: "q1", count: 2 });
    expect(r.crowned.d).toBeUndefined();
  });

  it("ignores votes for yourself and prompts with fewer than 3 votes (anonymity)", () => {
    const small = mostLikelyResults({
      questions: qs,
      players: people(),
      // q0: three real votes. q1: a voted for themself, so only 2 count.
      votes: { a: { q0: "b", q1: "a" }, b: { q0: "c", q1: "c" }, c: { q0: "a", q1: "a" } },
    });
    expect(small.likely.map((q) => q.questionId)).toEqual(["q0"]);
    expect(small.likely[0]!.voters).toBe(3);
  });

  it("only gives the awards about reading the room", () => {
    for (const a of r.awards) expect(["mind_reader", "clueless"]).toContain(a.award);
  });

  it("plays prompt packs, needs 3 players and skips guessing", () => {
    expect(votesForPlayers("most_likely")).toBe(true);
    expect(modeFormat("most_likely")).toBe("prompts");
    expect(modeMinPlayers("most_likely", 1)).toBe(3);
  });
});
