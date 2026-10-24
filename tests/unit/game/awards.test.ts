import { describe, expect, it } from "vitest";
import { AWARDS, pickAwards, type AwardCandidate, type AwardId } from "@/lib/game";

let n = 0;
function cand(id: string, extra: Partial<AwardCandidate> = {}): AwardCandidate {
  n++;
  return {
    playerId: id,
    nickname: id[0]!.toUpperCase() + id.slice(1),
    score: 50,
    avgGuessAbout: 50,
    mindReader: 50,
    guessCount: 2,
    joinedAt: 1000 * n,
    answersSubmittedAt: 10_000 + n,
    guessesSubmittedAt: 20_000 + n,
    ...extra,
  };
}

/** Extra players who never win a "low" award, to reach the 5-player Clueless minimum. */
const crowd = (k: number) =>
  Array.from({ length: k }, (_, i) => cand(`zz${i}`, { mindReader: 50, score: 55 }));

const winner = (cs: AwardCandidate[], award: AwardId) =>
  pickAwards(cs).find((a) => a.award === award)?.playerId;

describe("award metadata", () => {
  it("lists six awards in fixed reveal order with icon, tone and shape", () => {
    expect(AWARDS.map((a) => [a.name, a.icon, a.tone, a.shape])).toEqual([
      ["Top Spiller", "drop", "accent", "circle"],
      ["Saint of the Room", "hands-praying", "inverse", "rounded"],
      ["Mind Reader", "eye", "raised", "circle"],
      ["Dark Horse", "horse", "inverse", "circle"],
      ["Open Book", "book-open", "accent", "rounded"],
      ["Clueless", "question", "raised", "circle"],
    ]);
  });
});

describe("pickAwards", () => {
  it("gives nothing when there are no players", () => {
    expect(pickAwards([])).toEqual([]);
  });

  it("gives no awards below 3 players (SRS 4.3)", () => {
    expect(pickAwards([cand("solo")])).toEqual([]);
    expect(pickAwards([cand("a", { score: 27 }), cand("b", { score: 20 })])).toEqual([]);
  });

  it("picks each winner by its rule and writes the prototype reason copy", () => {
    const cs = [
      cand("ama", { score: 82, avgGuessAbout: 80, mindReader: 70 }),
      cand("efua", { score: 9, avgGuessAbout: 30, mindReader: 60 }),
      cand("zainab", { score: 50, avgGuessAbout: 52, mindReader: 91 }),
      cand("kofi", { score: 71, avgGuessAbout: 40, mindReader: 33 }),
      cand("yaw", { score: 40, avgGuessAbout: 45, mindReader: 50 }),
    ];
    const awards = pickAwards(cs);
    expect(awards.map((a) => a.position)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(awards.map((a) => [a.award, a.playerId, a.reason])).toEqual([
      ["top_spiller", "ama", "Highest score in the room. 82 out of 100."],
      ["saint_of_the_room", "efua", "Scored 9. Either a saint or a very good liar."],
      ["mind_reader", "zainab", "Closest guesses in the room. 91 points."],
      ["dark_horse", "kofi", "The room guessed 40. Kofi scored 71."],
      ["open_book", "ama", "The room guessed 80. Ama scored 82. Close enough."],
      ["clueless", "kofi", "Furthest guesses in the room. Kofi, really?"],
    ]);
    expect(awards[0]).toMatchObject({
      name: "Top Spiller",
      icon: "drop",
      tone: "accent",
      shape: "circle",
    });
  });

  it("Top Spiller tie goes to the earliest answers submit", () => {
    const cs = [
      cand("a", { score: 80, answersSubmittedAt: 500 }),
      cand("b", { score: 80, answersSubmittedAt: 300 }),
      cand("c", { score: 10 }),
    ];
    expect(winner(cs, "top_spiller")).toBe("b");
  });

  it("Saint tie goes to the earliest answers submit; never-submitted sorts last", () => {
    const cs = [
      cand("a", { score: 5, answersSubmittedAt: null }),
      cand("b", { score: 5, answersSubmittedAt: 900 }),
      cand("c", { score: 60 }),
    ];
    expect(winner(cs, "saint_of_the_room")).toBe("b");
  });

  it("Mind Reader tie goes to the earliest guesses submit", () => {
    const cs = [
      cand("a", { mindReader: 90, guessesSubmittedAt: 800 }),
      cand("b", { mindReader: 90, guessesSubmittedAt: 700 }),
      cand("c", { mindReader: 40 }),
    ];
    expect(winner(cs, "mind_reader")).toBe("b");
  });

  it("Dark Horse is the largest score minus room guess, tie to earliest join", () => {
    const cs = [
      cand("a", { score: 30, avgGuessAbout: 70, joinedAt: 1 }),
      cand("b", { score: 70, avgGuessAbout: 50, joinedAt: 3 }),
      cand("c", { score: 60, avgGuessAbout: 40, joinedAt: 2 }),
    ];
    // a has the largest absolute gap but in the wrong direction; b and c tie at +20.
    expect(winner(cs, "dark_horse")).toBe("c");
  });

  it("gives no Dark Horse when nobody beat the room's guess (SRS 4.3: positive gap)", () => {
    const cs = [
      cand("a", { score: 30, avgGuessAbout: 70 }),
      cand("b", { score: 40, avgGuessAbout: 50 }),
      cand("c", { score: 20, avgGuessAbout: 21 }),
    ];
    expect(winner(cs, "dark_horse")).toBeUndefined();
    expect(pickAwards(cs).map((a) => a.position)).toEqual([1, 2, 3, 4]);
  });

  it("does not give Open Book to the Dark Horse", () => {
    const cs = [
      cand("a", { score: 52, avgGuessAbout: 50 }),
      cand("b", { score: 30, avgGuessAbout: 40 }),
      cand("c", { score: 20, avgGuessAbout: 45 }),
    ];
    expect(winner(cs, "dark_horse")).toBe("a");
    expect(winner(cs, "open_book")).toBe("b");
  });

  it("shows Clueless only in rooms of 5 or more (SRS 4.3)", () => {
    const four = [cand("a"), cand("b"), cand("c"), cand("d")];
    expect(winner(four, "clueless")).toBeUndefined();
    expect(winner([...four, cand("e")], "clueless")).toBeDefined();
  });

  it("Open Book is the smallest absolute gap, tie to earliest join", () => {
    const cs = [
      cand("a", { score: 30, avgGuessAbout: 35, joinedAt: 5 }),
      cand("b", { score: 60, avgGuessAbout: 55, joinedAt: 4 }),
      cand("c", { score: 90, avgGuessAbout: 10, joinedAt: 1 }),
    ];
    expect(winner(cs, "open_book")).toBe("b");
  });

  it("Clueless tie goes to the latest guesses submit", () => {
    const cs = [
      cand("a", { mindReader: 20, guessesSubmittedAt: 100 }),
      cand("b", { mindReader: 20, guessesSubmittedAt: 900 }),
      cand("c", { mindReader: 80 }),
      ...crowd(2),
    ];
    expect(winner(cs, "clueless")).toBe("b");
  });

  it("Clueless tie prefers a player who never submitted guesses (latest of all)", () => {
    const cs = [
      cand("a", { mindReader: 20, guessesSubmittedAt: 900 }),
      cand("b", { mindReader: 20, guessesSubmittedAt: null }),
      ...crowd(3),
    ];
    expect(winner(cs, "clueless")).toBe("b");
  });

  it("Mind Reader and Clueless skip players who made no guesses", () => {
    const cs = [
      cand("a", { mindReader: 0, guessCount: 0 }),
      cand("b", { mindReader: 40 }),
      cand("c", { mindReader: 60 }),
      ...crowd(2),
    ];
    expect(winner(cs, "clueless")).toBe("b");
    expect(winner(cs, "mind_reader")).toBe("c");
  });

  it("falls back to everyone when nobody guessed", () => {
    const cs = [
      cand("a", { mindReader: 0, guessCount: 0 }),
      cand("b", { mindReader: 0, guessCount: 0 }),
      cand("c", { mindReader: 0, guessCount: 0 }),
      cand("d", { mindReader: 0, guessCount: 0 }),
      cand("e", { mindReader: 0, guessCount: 0 }),
    ];
    expect(winner(cs, "mind_reader")).toBe("a");
    expect(winner(cs, "clueless")).toBe("e");
  });

  it("breaks full ties by earliest join, then player id", () => {
    const tie = { answersSubmittedAt: 1 };
    const cs = [
      cand("b", { ...tie, joinedAt: 1 }),
      cand("a", { ...tie, joinedAt: 1 }),
      cand("c", { ...tie, joinedAt: 0 }),
    ];
    expect(winner(cs, "top_spiller")).toBe("c");
    const pair = [...cs.slice(0, 2), cand("d", { score: 10 })];
    expect(winner(pair, "top_spiller")).toBe("a");
    expect(winner([...pair].reverse(), "top_spiller")).toBe("a");
  });

  it("does not depend on input order", () => {
    const cs = [
      cand("a", { score: 40, avgGuessAbout: 45, mindReader: 70 }),
      cand("b", { score: 40, avgGuessAbout: 45, mindReader: 70 }),
      cand("c", { score: 90, avgGuessAbout: 60, mindReader: 20 }),
    ];
    expect(pickAwards([...cs].reverse())).toEqual(pickAwards(cs));
  });
});
