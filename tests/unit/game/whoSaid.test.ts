import { describe, expect, it } from "vitest";
import {
  answersToGuess,
  availableModes,
  modeFormat,
  whoSaidResults,
  writesAnswers,
} from "@/lib/game";
import { player, questions } from "./fixtures";

const qs = questions(1);
const people = () => ["a", "b", "c"].map((id) => player(id, id.toUpperCase()));
const texts = [
  { id: "ta", playerId: "a", questionId: "q0", body: "A wrote this", hidden: false },
  { id: "tb", playerId: "b", questionId: "q0", body: "B wrote this", hidden: false },
  { id: "tc", playerId: "c", questionId: "q0", body: "C wrote this", hidden: true },
];

describe("Who Said That?", () => {
  it("shows each viewer everyone else's shown answers, without authors", () => {
    const board = answersToGuess({ questions: qs, players: people(), texts, seed: "r1" }, "a");
    expect(board).toHaveLength(1);
    expect(board[0]!.answers.map((x) => x.id)).toEqual(["tb"]);
    expect(JSON.stringify(board)).not.toContain("playerId");
  });

  it("scores right guesses and answers that fool the room", () => {
    const r = whoSaidResults({
      questions: qs,
      players: people(),
      texts,
      seed: "r1",
      // b and c guess a's answer: b right, c wrong. a guesses b's answer right.
      whose: { b: { ta: "a" }, c: { ta: "b", tb: "a" }, a: { tb: "b" } },
    });
    const pts = Object.fromEntries(r.rows.map((x) => [x.playerId, x.mindReader]));
    // a: right on tb (10) + fooled c on ta (5). b: right on ta (10) + fooled c on tb (5). c: 0.
    expect(pts).toEqual({ a: 15, b: 15, c: 0 });
    const ta = r.said[0]!.answers.find((x) => x.id === "ta")!;
    expect(ta).toMatchObject({ playerId: "a", right: 1, guessers: 2 });
    expect(r.spotted.c).toEqual({ right: 0, total: 2 });
    // A hidden answer earns nothing and is not guessed on.
    expect(r.said[0]!.answers.find((x) => x.id === "tc")).toMatchObject({
      hidden: true,
      guessers: 0,
    });
  });

  it("leaves out answers from a player the host moved on without, who still guesses", () => {
    // c wrote an answer, then sat out before locking answers in (SPIL-15).
    const moved = [
      player("a", "A"),
      player("b", "B"),
      player("c", "C", { status: "sat_out", answersSubmittedAt: null }),
    ];
    const shown = texts.map((x) => (x.id === "tc" ? { ...x, hidden: false } : x));
    const board = answersToGuess({ questions: qs, players: moved, texts: shown, seed: "r1" }, "a");
    expect(board[0]!.answers.map((x) => x.id)).toEqual(["tb"]);
    const r = whoSaidResults({
      questions: qs,
      players: moved,
      texts: shown,
      seed: "r1",
      // c still guesses (right on ta); a guess on c's left-out answer earns nothing.
      whose: { c: { ta: "a" }, a: { tc: "c" } },
    });
    expect(r.said[0]!.answers.map((x) => x.id).sort()).toEqual(["ta", "tb"]);
    // c is not ranked (sat out, like every game), but c's right guess counts on a's answer.
    expect(r.rows.map((x) => x.playerId).sort()).toEqual(["a", "b"]);
    expect(r.rows.find((x) => x.playerId === "a")!.mindReader).toBe(0);
    expect(r.said[0]!.answers.find((x) => x.id === "ta")).toMatchObject({ right: 1, guessers: 1 });
  });

  it("is 18+ only and plays open prompt packs", () => {
    expect(writesAnswers("who_said")).toBe(true);
    expect(modeFormat("who_said")).toBe("open");
    expect(availableModes(16)).not.toContain("who_said");
    expect(availableModes(18)).toContain("who_said");
  });
});
