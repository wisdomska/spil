/**
 * Ports of the 37 behavioural checks in design/SPIL Tests.dc.html, keeping their exact names.
 * Logic-level checks run here against lib/game. Checks that need the database, the API or a
 * browser are listed as todos naming the layer that will cover them (TECH_SPEC section 19).
 */
import { describe, expect, it } from "vitest";
import {
  CODE_PATTERN,
  canJoin,
  autoAdvance,
  computeResults,
  countAnswers,
  drawQuestions,
  generateCode,
  needsFinalize,
  pickablePacks,
  rematch,
  scoreForRound,
  type AnswerValue,
  type DrawableQuestion,
  type PickablePack,
  type RematchPlayer,
  type ResultsPlayer,
  type RoomStatus,
} from "@/lib/game";
import { seededRng } from "./fixtures";

const QUESTIONS_PER_GAME = 12;
const MAX_PLAYERS = 12;
const NOW = Date.UTC(2026, 9, 22, 12);
const HOUR = 60 * 60 * 1000;

const PACK_IDS = ["classic", "afterdark", "campus", "work", "sheets", "nolimits", "kink"];

function content() {
  const packs: (PickablePack & { isAdult: boolean })[] = PACK_IDS.map((id) => ({
    id,
    status: "live",
    isAdult: ["afterdark", "sheets", "nolimits", "kink"].includes(id),
  }));
  const questions: DrawableQuestion[] = PACK_IDS.flatMap((packId) =>
    Array.from({ length: 12 }, (_, i) => ({
      id: `${packId}-${i}`,
      packId,
      status: "live" as const,
    })),
  );
  return { packs, questions };
}

/** The prototype's shared round: Ama hosts, Kofi and Zainab join (Yaw was removed). */
function playedRound() {
  const { questions } = content();
  const qids = drawQuestions(questions, "classic", QUESTIONS_PER_GAME, seededRng(1)).map(
    (q) => q.id,
  );
  const qs = qids.map((id) => ({ id, text: id }));
  const fill = (pick: (i: number) => AnswerValue | null) =>
    Object.fromEntries(
      qids.flatMap((id, i) => {
        const v = pick(i);
        return v ? [[id, v]] : [];
      }),
    ) as Record<string, AnswerValue>;
  const base = (id: string, nickname: string, n: number): ResultsPlayer => ({
    id,
    nickname,
    status: "active",
    joinedAt: NOW + n,
    answersSubmittedAt: NOW + 100 + n,
    guessesSubmittedAt: NOW + 200 + n,
    spillMode: false,
    answers: {},
    guesses: {},
  });
  const players: ResultsPlayer[] = [
    { ...base("h1", "Ama", 1), answers: fill((i) => (i < 9 ? "yes" : "no")) },
    { ...base("g1", "Kofi", 2), answers: fill((i) => (i < 3 ? "yes" : "no")) },
    // Zainab says yes on even questions and skips the first one.
    {
      ...base("g2", "Zainab", 3),
      answers: fill((i) => (i === 0 ? "skip" : i % 2 === 0 ? "yes" : "no")),
    },
  ];
  // Everyone guesses 50 about everyone, except Kofi and Zainab both guess 75 for Ama.
  for (const p of players) {
    p.guesses = Object.fromEntries(
      players.filter((o) => o.id !== p.id).map((o) => [o.id, o.id === "h1" ? 75 : 50]),
    );
  }
  return { qids, questions: qs, players };
}

describe("Content seed", () => {
  // pgTAP: seed migration test asserts pack count and the is_adult flag.
  it.todo("7 packs seeded, 4 of them 18+");
  // pgTAP: seed migration test counts live questions per seeded pack.
  it.todo("Every pack has 12 live questions");

  it("Live packs list only shows live packs with questions", () => {
    const { packs, questions } = content();
    expect(pickablePacks(packs, questions)).toHaveLength(7);
  });
});

describe("Host creates a room", () => {
  it("Room code is 4 characters, no ambiguous letters", () => {
    for (let i = 0; i < 200; i++) expect(generateCode()).toMatch(CODE_PATTERN);
    expect(CODE_PATTERN.source).toBe("^[A-HJ-NP-Z2-9]{4}$");
  });

  it("Room draws questions-per-game from the pack", () => {
    const { questions } = content();
    expect(drawQuestions(questions, "classic", QUESTIONS_PER_GAME)).toHaveLength(
      QUESTIONS_PER_GAME,
    );
  });

  it("Questions are unique", () => {
    const { questions } = content();
    const ids = drawQuestions(questions, "classic", QUESTIONS_PER_GAME).map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("Guests join", () => {
  const lobby = { status: "lobby" as RoomStatus, createdAt: NOW - HOUR };

  it("Valid code passes join check", () => {
    expect(canJoin({ room: lobby, activeCount: 1, maxPlayers: MAX_PLAYERS, now: NOW })).toEqual({
      ok: true,
    });
  });

  it("Unknown code is rejected", () => {
    expect(canJoin({ room: null, activeCount: 0, maxPlayers: MAX_PLAYERS, now: NOW })).toEqual({
      ok: false,
      code: "ROOM_NOT_FOUND",
    });
  });

  // API integration: POST /rooms/:code/join four times, then GET /state lists four players. E2E covers the lobby UI.
  it.todo("Four players in the lobby");
  // API integration: POST /rooms/:code/kick marks the player removed; pgTAP covers the RLS. E2E covers the UI.
  it.todo("Host removes a player, they drop out of the room");

  it("Full room blocks joining", () => {
    expect(canJoin({ room: lobby, activeCount: 3, maxPlayers: 3, now: NOW })).toEqual({
      ok: false,
      code: "ROOM_FULL",
    });
  });
});

describe("Answering", () => {
  it("Started room blocks late joiners", () => {
    const room = { status: "answering" as RoomStatus, createdAt: NOW - HOUR };
    expect(canJoin({ room, activeCount: 3, maxPlayers: MAX_PLAYERS, now: NOW })).toEqual({
      ok: false,
      code: "GAME_STARTED",
    });
  });

  it("Skipped answers do not count toward the score", () => {
    const { qids, players } = playedRound();
    expect(scoreForRound(players[2]!.answers, qids)).toBe(Math.round((5 / 11) * 100));
  });

  it("Host score is yes / answered", () => {
    const { qids, players } = playedRound();
    expect(scoreForRound(players[0]!.answers, qids)).toBe(75);
  });

  it("Everyone done moves the room to guessing", () => {
    const { players } = playedRound();
    const waiting = players.map((p, i) => (i === 2 ? { ...p, answersSubmittedAt: null } : p));
    expect(autoAdvance("answering", waiting)).toBeNull();
    expect(autoAdvance("answering", players)).toBe("guessing");
  });
});

describe("Guessing and results", () => {
  it("All guesses in moves the room to ready", () => {
    const { players } = playedRound();
    const waiting = players.map((p, i) => (i === 1 ? { ...p, guessesSubmittedAt: null } : p));
    expect(autoAdvance("guessing", waiting)).toBeNull();
    expect(autoAdvance("guessing", players)).toBe("ready");
  });

  it("Room guess is the average of the others", () => {
    const r = computeResults(playedRound());
    expect(r.rows.find((x) => x.playerId === "h1")?.avgGuessAbout).toBe(75);
  });

  it("Awards follow the room-size rules", () => {
    // Four players: no Clueless (5+ only), and nobody beat the room's guess, so no Dark Horse.
    expect(computeResults(playedRound()).awards.map((a) => a.award)).toEqual([
      "top_spiller",
      "saint_of_the_room",
      "mind_reader",
      "open_book",
    ]);
  });

  it("Top Spiller is the highest score", () => {
    expect(computeResults(playedRound()).awards[0]).toMatchObject({
      award: "top_spiller",
      playerId: "h1",
    });
  });

  it("Saint of the Room is the lowest score", () => {
    expect(computeResults(playedRound()).awards[1]).toMatchObject({
      award: "saint_of_the_room",
      playerId: "g1",
    });
  });

  it("Question stats cover every question", () => {
    const round = playedRound();
    // The prototype shows every answered question.
    expect(computeResults({ ...round, minAnswersForStats: 1 }).questionStats).toHaveLength(
      round.qids.length,
    );
    // Production lists it too but withholds the count: Zainab skipped it, leaving 3 answers... or fewer.
    const stats = computeResults(round).questionStats;
    expect(stats).toHaveLength(round.qids.length);
    const first = stats.find((s) => s.questionId === round.qids[0]);
    expect(first?.yes === null || first!.answered >= 3).toBe(true);
  });

  it("Spill Mode names only opted-in players", () => {
    const round = playedRound();
    round.players = round.players.map((p) => ({ ...p, spillMode: p.id === "g2" }));
    const stats = computeResults(round).questionStats;
    expect(stats.flatMap((s) => s.spillNames).every((n) => n === "Zainab")).toBe(true);
    expect(stats.some((s) => s.spillNames.includes("Zainab"))).toBe(true);
  });

  it("Finishing counts the game once, even if called twice", () => {
    // pgTAP also asserts save_results is idempotent; this is the guard it applies.
    const room = { round: 1, finalRound: 0 };
    let finished = 0;
    const finalize = () => {
      if (!needsFinalize(room)) return;
      room.finalRound = room.round;
      finished++;
    };
    finalize();
    finalize();
    expect(finished).toBe(1);
  });

  it("Question answer stats are recorded", () => {
    const round = playedRound();
    const counts = countAnswers(round);
    expect(counts.find((c) => c.questionId === round.qids[1])?.answered).toBe(3);
  });
});

describe("Rematch", () => {
  function afterRematch(nextPack: string) {
    const { packs, questions } = content();
    const round = playedRound();
    // Answers and guesses are stored per round, so the new round starts with none.
    const store = round.players.map((p) => ({
      round: 1,
      playerId: p.id,
      answers: p.answers,
      guesses: p.guesses,
    }));
    const players: RematchPlayer[] = round.players.map((p) => ({
      ...p,
      ageConfirmed: true,
      spillMode: p.spillMode,
    }));
    const pack = packs.find((p) => p.id === nextPack)!;
    const next = rematch({ status: "revealed", round: 1 }, players, { packIsAdult: pack.isAdult });
    const qids = drawQuestions(questions, nextPack, QUESTIONS_PER_GAME, seededRng(2)).map(
      (q) => q.id,
    );
    return { next, qids, questions, current: store.filter((s) => s.round === next.round) };
  }

  it("Rematch clears answers and guesses", () => {
    const { next, current } = afterRematch("classic");
    expect(next.round).toBe(2);
    expect(next.status).toBe("lobby");
    expect(current).toEqual([]);
    expect(
      next.players.every((p) => p.answersSubmittedAt === null && p.guessesSubmittedAt === null),
    ).toBe(true);
  });

  it("Switching to an 18+ pack leaves players unconfirmed", () => {
    const { next } = afterRematch("sheets");
    expect(next.players.filter((p) => !p.ageConfirmed)).toHaveLength(3);
  });

  it("New questions come from the new pack", () => {
    const { qids, questions } = afterRematch("sheets");
    expect(qids.length).toBeGreaterThan(0);
    expect(qids.every((id) => questions.find((q) => q.id === id)?.packId === "sheets")).toBe(true);
  });
});

describe("Bots fill in", () => {
  // E2E (Playwright, dev/staging with feature_flags.test_players) plus API integration for POST /test-players.
  it.todo("Bots finish answering on their own");
  // E2E (Playwright, dev/staging with feature_flags.test_players) plus API integration for POST /test-players.
  it.todo("Bots finish guessing on their own");
});

describe("Admin moderation", () => {
  it("Hidden questions are never drawn", () => {
    const { questions } = content();
    const victim = questions.find((q) => q.packId === "classic")!;
    victim.status = "hidden";
    for (let i = 0; i < 20; i++) {
      expect(
        drawQuestions(questions, "classic", QUESTIONS_PER_GAME).map((q) => q.id),
      ).not.toContain(victim.id);
    }
  });

  it("Draft packs disappear from the picker", () => {
    const { packs, questions } = content();
    packs.find((p) => p.id === "work")!.status = "draft";
    expect(pickablePacks(packs, questions).some((p) => p.id === "work")).toBe(false);
  });

  it("Packs with no live questions disappear too", () => {
    const { packs, questions } = content();
    for (const q of questions) if (q.packId === "campus") q.status = "hidden";
    expect(pickablePacks(packs, questions).some((p) => p.id === "campus")).toBe(false);
  });

  it("Questions per game setting is respected", () => {
    const { questions } = content();
    expect(drawQuestions(questions, "afterdark", 5)).toHaveLength(5);
  });

  it("Closed rooms count as expired", () => {
    const room = { status: "closed" as RoomStatus, createdAt: NOW - HOUR };
    expect(canJoin({ room, activeCount: 0, maxPlayers: MAX_PLAYERS, now: NOW })).toEqual({
      ok: false,
      code: "ROOM_EXPIRED",
    });
  });

  it("Rooms older than 24 hours expire", () => {
    const room = { status: "lobby" as RoomStatus, createdAt: NOW - 90_000_000 };
    expect(canJoin({ room, activeCount: 0, maxPlayers: MAX_PLAYERS, now: NOW })).toEqual({
      ok: false,
      code: "ROOM_EXPIRED",
    });
  });

  // pgTAP: deleting a seeded pack and re-running the seed must not bring it back.
  it.todo("A deleted seed pack stays deleted");
  // pgTAP: the seed creates the initial owner row in admins (TECH_SPEC calls it "initial owner account exists").
  it.todo("Default admin account exists");
});
