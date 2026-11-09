import { describe, expect, it } from "vitest";
import {
  MIN_ANSWERS_FOR_STATS,
  shownYesCount,
  computeResults,
  countAnswers,
  rankByGuessing,
  isScored,
  type ResultsInput,
} from "@/lib/game";
import { answers, guessAll, player, questions } from "./fixtures";

const qs = questions(10);

/** Ama 80, Kofi 30, Zainab 50, Yaw 100. */
function room(): ResultsInput {
  const players = guessAll(
    [
      player("ama", "Ama", { answers: answers(qs, (i) => (i < 8 ? "yes" : "no")) }),
      player("kofi", "Kofi", { answers: answers(qs, (i) => (i < 3 ? "yes" : "no")) }),
      player("zainab", "Zainab", { answers: answers(qs, (i) => (i % 2 === 0 ? "yes" : "no")) }),
      player("yaw", "Yaw", { answers: answers(qs, () => "yes") }),
    ],
    50,
  );
  return { questions: qs, players };
}

const row = (r: ReturnType<typeof computeResults>, id: string) => {
  const found = r.rows.find((x) => x.playerId === id);
  if (!found) throw new Error(`no row for ${id}`);
  return found;
};

describe("computeResults rows", () => {
  it("scores each player and ranks the best guesser first", () => {
    const r = computeResults(room());
    // Everyone guessed 50 about everyone, so every guess on a target ties for closest (+3).
    // Off by 50: 0, 30: 0, 0: 10, 20: 2. Yaw and Ama tie on 21; the higher Spill Score lists first.
    expect(r.rows.map((x) => [x.playerId, x.score, x.mindReader, x.rank])).toEqual([
      ["yaw", 100, 21, 1],
      ["ama", 80, 21, 1],
      ["kofi", 30, 19, 3],
      ["zainab", 50, 11, 4],
    ]);
  });

  it("puts players who made no guesses last", () => {
    const input = room();
    input.players = input.players.map((p) => (p.id === "yaw" ? { ...p, guesses: {} } : p));
    const r = computeResults(input);
    expect(r.rows.at(-1)).toMatchObject({ playerId: "yaw", mindReader: 0, rank: 4 });
  });

  it("attaches the label for each score", () => {
    const r = computeResults(room());
    expect(row(r, "yaw").label).toBe("legendary_menace");
    expect(row(r, "ama").label).toBe("legendary_menace");
    expect(row(r, "zainab").label).toBe("been_around");
    expect(row(r, "kofi").label).toBe("mostly_innocent");
  });

  it("ties share a rank and the next rank skips (1, 1, 3)", () => {
    const input = room();
    // Ama and Zainab guess everyone exactly; the higher Spill Score lists first within the tie.
    const exact = { yaw: 100, ama: 80, zainab: 50, kofi: 30 };
    input.players = input.players.map((p) =>
      p.id === "ama" || p.id === "zainab"
        ? {
            ...p,
            guesses: Object.fromEntries(Object.entries(exact).filter(([id]) => id !== p.id)),
          }
        : p,
    );
    const r = computeResults(input);
    // Three exact guesses each, all closest: 3 x 13 = 39.
    expect(r.rows.map((x) => [x.playerId, x.mindReader, x.rank])).toEqual([
      ["ama", 39, 1],
      ["zainab", 39, 1],
      ["yaw", 15, 3],
      ["kofi", 13, 4],
    ]);
    expect(row(r, "ama").bullseyes).toBe(3);
    expect(row(r, "yaw").bullseyes).toBe(1);
  });

  it("avgGuessAbout is the rounded mean of the others' guesses", () => {
    const input = room();
    input.players = input.players.map((p) =>
      p.id === "ama"
        ? p
        : { ...p, guesses: { ...p.guesses, ama: { kofi: 70, zainab: 75, yaw: 81 }[p.id] } },
    );
    expect(row(computeResults(input), "ama").avgGuessAbout).toBe(Math.round((70 + 75 + 81) / 3));
  });

  it("avgGuessAbout equals the player's score when nobody guessed about them", () => {
    const input = room();
    input.players = input.players.map((p) => {
      const g = { ...p.guesses };
      delete g.kofi;
      return { ...p, guesses: g };
    });
    expect(row(computeResults(input), "kofi").avgGuessAbout).toBe(30);
  });

  it("mindReader sums banded points per guess plus the closest bonus (SPIL-09)", () => {
    const input = room();
    // Ama: exact on Kofi (10, closest +3), exact on Zainab (10, tied closest +3), 40 off on Yaw
    // (0 points, but still the closest of three, +3).
    input.players = input.players.map((p) =>
      p.id === "ama" ? { ...p, guesses: { kofi: 30, zainab: 50, yaw: 60 } } : p,
    );
    expect(row(computeResults(input), "ama").mindReader).toBe(13 + 13 + 3);
  });

  it("mindReader is 0 when the player made no guesses", () => {
    const input = room();
    input.players = input.players.map((p) => (p.id === "kofi" ? { ...p, guesses: {} } : p));
    expect(row(computeResults(input), "kofi").mindReader).toBe(0);
  });

  it("ignores self-guesses, unknown targets, non-numbers, and clamps to 0..100", () => {
    const input = room();
    input.players = input.players.map((p) =>
      p.id === "ama"
        ? { ...p, guesses: { ama: 0, ghost: 10, kofi: Number.NaN, zainab: 150, yaw: -20 } }
        : p,
    );
    const r = computeResults(input);
    // zainab: clamp 150 -> 100, 50 off: 0. yaw: clamp -20 -> 0, 100 off: 0. kofi: NaN skipped.
    expect(row(r, "ama").mindReader).toBe(0);
    expect(row(r, "ama").avgGuessAbout).toBe(50);
    expect(row(r, "zainab").avgGuessAbout).toBe(Math.round((100 + 50 + 50) / 3));
  });

  it("carries spillMode through", () => {
    const input = room();
    input.players = input.players.map((p) => ({ ...p, spillMode: p.id === "zainab" }));
    const r = computeResults(input);
    expect(r.rows.filter((x) => x.spillMode).map((x) => x.playerId)).toEqual(["zainab"]);
  });

  it("only counts answers to this round's questions", () => {
    const input = room();
    input.players = input.players.map((p) =>
      p.id === "kofi" ? { ...p, answers: { ...p.answers, stale: "yes" } } : p,
    );
    expect(row(computeResults(input), "kofi").score).toBe(30);
  });

  it("accepts ISO strings and Dates for times", () => {
    const input = room();
    input.players = input.players.map((p, i) => ({
      ...p,
      joinedAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
      answersSubmittedAt: new Date(Date.UTC(2026, 0, 1, 1, i)),
      guessesSubmittedAt: null,
    }));
    expect(computeResults(input).rows).toHaveLength(4);
  });

  it("is deterministic and independent of player order", () => {
    const a = computeResults(room());
    const input = room();
    const b = computeResults({ ...input, players: [...input.players].reverse() });
    expect(b).toEqual(a);
    expect(computeResults(room())).toEqual(a);
  });

  it("does not mutate its input", () => {
    const input = room();
    const snapshot = JSON.stringify(input);
    computeResults(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("returns empty results for an empty room", () => {
    expect(computeResults({ questions: qs, players: [] })).toEqual({
      rows: [],
      guessPoints: [],
      awards: [],
      questionStats: [],
    });
  });
});

describe("sat_out and departed players", () => {
  it("drops players who left or were removed", () => {
    const input = room();
    input.players = input.players.map((p) =>
      p.id === "yaw" ? { ...p, status: "left" } : p.id === "kofi" ? { ...p, status: "removed" } : p,
    );
    const r = computeResults(input);
    expect(r.rows.map((x) => x.playerId)).toEqual(["ama", "zainab"]);
    expect(r.awards.every((a) => a.playerId === "ama" || a.playerId === "zainab")).toBe(true);
  });

  it("sat out for answers: no score, not a guess target, but their guesses still count", () => {
    const input = room();
    input.players = input.players.map((p) =>
      p.id === "yaw"
        ? {
            ...p,
            status: "sat_out",
            answersSubmittedAt: null,
            guessesSubmittedAt: null,
            guesses: { ama: 0 },
          }
        : p,
    );
    const r = computeResults(input);
    expect(r.rows.map((x) => x.playerId)).not.toContain("yaw");
    // Ama's guess about Yaw no longer counts toward her Mind Reader (Yaw has no score), but Yaw
    // can still guess: their 0 joins Kofi's and Zainab's 50s in the room's guess about Ama.
    expect(row(r, "ama").avgGuessAbout).toBe(Math.round((50 + 50 + 0) / 3));
    // Only two people guessed Kofi and Zainab, so no closest bonus: 20 off is 2, exact is 10.
    expect(row(r, "ama").mindReader).toBe(2 + 10);
    expect(countAnswers(input).every((c) => c.answered === 3)).toBe(true);
  });

  it("sat out for guesses: keeps a score and partial guesses count", () => {
    const input = room();
    input.players = input.players.map((p) =>
      p.id === "kofi"
        ? { ...p, status: "sat_out", guessesSubmittedAt: null, guesses: { ama: 80 } }
        : p,
    );
    const r = computeResults(input);
    expect(row(r, "kofi").score).toBe(30);
    // Exact on Ama, and the closest of three guessers: 10 + 3.
    expect(row(r, "kofi").mindReader).toBe(13);
  });

  it("isScored follows the sat_out rules", () => {
    const base = room().players[0]!;
    expect(isScored(base)).toBe(true);
    expect(isScored({ ...base, status: "left" })).toBe(false);
    expect(isScored({ ...base, status: "removed" })).toBe(false);
    expect(isScored({ ...base, status: "sat_out" })).toBe(true);
    expect(isScored({ ...base, status: "sat_out", answersSubmittedAt: null })).toBe(false);
  });
});

describe("awards via computeResults", () => {
  it("gives the awards in reveal order (no Clueless below 5 players)", () => {
    const r = computeResults(room());
    expect(r.awards.map((a) => a.award)).toEqual([
      "top_spiller",
      "saint_of_the_room",
      "mind_reader",
      "dark_horse",
      "open_book",
    ]);
    expect(r.awards[0]).toMatchObject({
      playerId: "yaw",
      reason: "Highest score in the room. 100 out of 100.",
    });
    expect(r.awards[1]).toMatchObject({
      playerId: "kofi",
      reason: "Scored 30. Either a saint or a very good liar.",
    });
  });

  it("Dark Horse uses the room guess in its reason", () => {
    const r = computeResults(room());
    // Everyone guessed 50 about everyone, so Yaw (100) is the biggest surprise.
    expect(r.awards[3]).toMatchObject({
      playerId: "yaw",
      reason: "The room guessed 50. Yaw scored 100.",
    });
    expect(r.awards[4]).toMatchObject({
      playerId: "zainab",
      reason: "The room guessed 50. Zainab scored 50. Close enough.",
    });
  });
});

describe("rankByGuessing", () => {
  it("re-ranks stored rows by guessing points, Spill Score breaking ties", () => {
    const rows = [
      { id: "senya", score: 27, mindReader: 46 },
      { id: "steph", score: 20, mindReader: 62 },
      { id: "kofi", score: 50, mindReader: 46 },
    ];
    expect(rankByGuessing(rows).map((r) => [r.id, r.rank])).toEqual([
      ["steph", 1],
      ["kofi", 2],
      ["senya", 2],
    ]);
  });
});

describe("question stats", () => {
  it(`only includes questions with ${MIN_ANSWERS_FOR_STATS}+ answers`, () => {
    const input = room();
    input.players = input.players.map((p) =>
      p.id === "ama" || p.id === "kofi"
        ? { ...p, answers: { ...p.answers, q0: "skip" as const } }
        : p,
    );
    const stats = computeResults(input).questionStats;
    // Still listed so players see what was asked, but the count is withheld.
    expect(stats).toHaveLength(10);
    expect(stats.find((s) => s.questionId === "q0")).toMatchObject({ yes: null, answered: 2 });
    // Withheld counts go last, in the order asked (q2 is withheld too: all four said yes).
    expect(stats.slice(-2).map((s) => s.questionId)).toEqual(["q0", "q2"]);
  });

  it("can relax the threshold (prototype behaviour)", () => {
    const input = { ...room(), minAnswersForStats: 1 };
    input.players = input.players.map((p) =>
      p.id === "yaw" ? p : { ...p, answers: { ...p.answers, q0: "skip" as const } },
    );
    expect(computeResults(input).questionStats.map((s) => s.questionId)).toContain("q0");
  });

  it("never shows a question nobody answered, whatever the threshold", () => {
    const input = { ...room(), minAnswersForStats: 0 };
    input.players = input.players.map((p) => ({
      ...p,
      answers: { ...p.answers, q0: "skip" as const },
    }));
    expect(computeResults(input).questionStats.map((s) => s.questionId)).not.toContain("q0");
  });

  it("counts yes and answered, sorted by yes share then draw order", () => {
    const stats = computeResults(room()).questionStats;
    expect(stats[0]).toMatchObject({ questionId: "q1", yes: 3, answered: 4 });
    expect(stats.map((s) => (s.yes ?? 0) / s.answered)).toEqual(
      [...stats.map((s) => (s.yes ?? 0) / s.answered)].sort((a, b) => b - a),
    );
    // q0 and q2 were yes from all four, so their counts are withheld and they go last.
    expect(stats.map((s) => s.questionId)).toEqual([
      "q1",
      "q4",
      "q6",
      "q3",
      "q5",
      "q7",
      "q8",
      "q9",
      "q0",
      "q2",
    ]);
    expect(stats[0]!.text).toBe("question 1?");
  });

  it("withholds a count a small room gave as one, since it shows everyone's answer", () => {
    expect(shownYesCount(3, 3)).toBeNull();
    expect(shownYesCount(0, 4)).toBeNull();
    expect(shownYesCount(2, 4)).toBe(2);
    expect(shownYesCount(5, 5)).toBe(5);
    expect(shownYesCount(0, 6)).toBe(0);
    expect(shownYesCount(2, 2)).toBeNull();
  });

  it("spillNames lists only Spill Mode players who said yes", () => {
    const input = room();
    input.players = input.players.map((p) => ({
      ...p,
      spillMode: p.id === "zainab" || p.id === "kofi",
    }));
    const stats = computeResults(input).questionStats;
    const q0 = stats.find((s) => s.questionId === "q0")!;
    const q1 = stats.find((s) => s.questionId === "q1")!;
    const q9 = stats.find((s) => s.questionId === "q9")!;
    expect(q0.spillNames).toEqual(["Kofi", "Zainab"]);
    expect(q1.spillNames).toEqual(["Kofi"]);
    expect(q9.spillNames).toEqual([]);
  });
});

describe("countAnswers", () => {
  it("counts yes and answered for every round question, skips excluded", () => {
    const input = room();
    input.players = input.players.map((p) =>
      p.id === "kofi" ? { ...p, answers: { ...p.answers, q9: "skip" as const } } : p,
    );
    const counts = countAnswers(input);
    expect(counts).toHaveLength(10);
    expect(counts[0]).toEqual({ questionId: "q0", yes: 4, answered: 4 });
    expect(counts[9]).toEqual({ questionId: "q9", yes: 1, answered: 3 });
  });
});
