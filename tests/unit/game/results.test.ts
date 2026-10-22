import { describe, expect, it } from "vitest";
import {
  MIN_ANSWERS_FOR_STATS,
  computeResults,
  countAnswers,
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
  it("scores each player and sorts by score descending", () => {
    const r = computeResults(room());
    expect(r.rows.map((x) => [x.playerId, x.score, x.rank])).toEqual([
      ["yaw", 100, 1],
      ["ama", 80, 2],
      ["zainab", 50, 3],
      ["kofi", 30, 4],
    ]);
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
    input.players = input.players.map((p) =>
      p.id === "ama" ? { ...p, answers: answers(qs, () => "yes") } : p,
    );
    const r = computeResults(input);
    expect(r.rows.map((x) => [x.playerId, x.rank])).toEqual([
      ["ama", 1],
      ["yaw", 1],
      ["zainab", 3],
      ["kofi", 4],
    ]);
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

  it("mindReader is average accuracy 0 to 100, not a sum", () => {
    const input = room();
    // Ama guesses exactly for Kofi (30) and Zainab (50), and 60 for Yaw (100): accuracy 100, 100, 60.
    input.players = input.players.map((p) =>
      p.id === "ama" ? { ...p, guesses: { kofi: 30, zainab: 50, yaw: 60 } } : p,
    );
    expect(row(computeResults(input), "ama").mindReader).toBe(Math.round((100 + 100 + 60) / 3));
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
    // zainab: clamp 150 -> 100, |100 - 50| = 50 -> 50. yaw: clamp -20 -> 0, |0 - 100| -> 0.
    expect(row(r, "ama").mindReader).toBe(25);
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

  it("sat out for answers: no score, not a guess target, guesses ignored", () => {
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
    // Ama's guess about Yaw no longer counts toward her Mind Reader; Yaw's guess about Ama is ignored.
    expect(row(r, "ama").avgGuessAbout).toBe(50);
    expect(row(r, "ama").mindReader).toBe(Math.round((100 - 20 + 100) / 2));
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
    expect(row(r, "kofi").mindReader).toBe(100);
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
  it("gives six awards in reveal order", () => {
    const r = computeResults(room());
    expect(r.awards.map((a) => a.award)).toEqual([
      "top_spiller",
      "saint_of_the_room",
      "mind_reader",
      "dark_horse",
      "open_book",
      "clueless",
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

describe("question stats", () => {
  it(`only includes questions with ${MIN_ANSWERS_FOR_STATS}+ answers`, () => {
    const input = room();
    input.players = input.players.map((p) =>
      p.id === "ama" || p.id === "kofi"
        ? { ...p, answers: { ...p.answers, q0: "skip" as const } }
        : p,
    );
    const ids = computeResults(input).questionStats.map((s) => s.questionId);
    expect(ids).not.toContain("q0");
    expect(ids).toHaveLength(9);
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
    expect(stats[0]).toMatchObject({ questionId: "q0", yes: 4, answered: 4 });
    expect(stats.map((s) => s.yes / s.answered)).toEqual(
      [...stats.map((s) => s.yes / s.answered)].sort((a, b) => b - a),
    );
    expect(stats.map((s) => s.questionId)).toEqual([
      "q0",
      "q2",
      "q1",
      "q4",
      "q6",
      "q3",
      "q5",
      "q7",
      "q8",
      "q9",
    ]);
    expect(stats[0]!.text).toBe("question 0?");
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
