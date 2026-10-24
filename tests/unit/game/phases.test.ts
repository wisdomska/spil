import { describe, expect, it } from "vitest";
import {
  HOST_INACTIVE_MS,
  JOIN_WINDOW_MS,
  NEXT_PHASE,
  activePlayers,
  allAnswered,
  allGuessed,
  autoAdvance,
  canSkipToReveal,
  isStuck,
  STUCK_AFTER_MS,
  guessTargets,
  planAdvance,
  SKIP_TO_REVEAL_MS,
  canJoin,
  canStart,
  isHostInactive,
  isRoomExpired,
  needsFinalize,
  nextHost,
  rematch,
  unfinishedPlayers,
  type PhasePlayer,
  type RematchPlayer,
} from "@/lib/game";

const NOW = Date.UTC(2026, 9, 22, 12);

const p = (id: string, joinedAt: number, extra: Partial<PhasePlayer> = {}): PhasePlayer => ({
  id,
  status: "active",
  joinedAt,
  answersSubmittedAt: null,
  guessesSubmittedAt: null,
  ageBand: "18_plus",
  lastSeenAt: NOW,
  ...extra,
});

const lobby = [p("h", 1), p("a", 2), p("b", 3)];

describe("transitions", () => {
  it("phases run lobby -> answering -> guessing -> ready -> revealed", () => {
    expect(NEXT_PHASE).toEqual({
      lobby: "answering",
      answering: "guessing",
      guessing: "ready",
      ready: "revealed",
    });
  });
});

describe("canStart", () => {
  it("needs the lobby", () => {
    expect(canStart({ status: "answering", players: lobby, minPlayers: 3, minAge: 13 })).toEqual({
      ok: false,
      code: "WRONG_PHASE",
    });
  });

  it("needs min_players active players", () => {
    expect(canStart({ status: "lobby", players: lobby, minPlayers: 3, minAge: 13 })).toEqual({
      ok: true,
    });
    const withLeaver = [...lobby.slice(0, 2), { ...lobby[2]!, status: "left" as const }];
    expect(canStart({ status: "lobby", players: withLeaver, minPlayers: 3, minAge: 13 })).toEqual({
      ok: false,
      code: "NOT_ENOUGH_PLAYERS",
    });
  });

  it("every active player's band must reach the pack's minimum age (SPIL-02)", () => {
    const withMinor = [...lobby.slice(0, 2), { ...lobby[2]!, ageBand: "16_17" as const }];
    expect(canStart({ status: "lobby", players: withMinor, minPlayers: 3, minAge: 18 })).toEqual({
      ok: false,
      code: "PACK_NOT_ALLOWED",
    });
    expect(canStart({ status: "lobby", players: withMinor, minPlayers: 3, minAge: 16 })).toEqual({
      ok: true,
    });
    const minorLeft = [...withMinor.slice(0, 2), { ...withMinor[2]!, status: "removed" as const }];
    expect(
      canStart({ status: "lobby", players: [...minorLeft, p("x", 9)], minPlayers: 3, minAge: 18 }),
    ).toEqual({ ok: true });
  });

  it("a player with no band counts as 13 to 15", () => {
    const unknown = lobby.map((x) => ({ ...x, ageBand: undefined }));
    expect(canStart({ status: "lobby", players: unknown, minPlayers: 3, minAge: 16 })).toEqual({
      ok: false,
      code: "PACK_NOT_ALLOWED",
    });
  });
});

describe("canJoin", () => {
  const room = { status: "lobby" as const, createdAt: NOW - 60_000 };

  it("allows joining an open lobby with space", () => {
    expect(canJoin({ room, activeCount: 3, maxPlayers: 12, now: NOW })).toEqual({ ok: true });
  });

  it("rejects unknown codes", () => {
    expect(canJoin({ room: null, activeCount: 0, maxPlayers: 12, now: NOW })).toEqual({
      ok: false,
      code: "ROOM_NOT_FOUND",
    });
  });

  it("rejects full rooms", () => {
    expect(canJoin({ room, activeCount: 12, maxPlayers: 12, now: NOW })).toEqual({
      ok: false,
      code: "ROOM_FULL",
    });
  });

  it.each(["answering", "guessing", "ready", "revealed"] as const)(
    "rejects a room in %s",
    (status) => {
      expect(
        canJoin({ room: { ...room, status }, activeCount: 3, maxPlayers: 12, now: NOW }),
      ).toEqual({
        ok: false,
        code: "GAME_STARTED",
      });
    },
  );

  it("closed rooms are expired", () => {
    expect(
      canJoin({ room: { ...room, status: "closed" }, activeCount: 0, maxPlayers: 12, now: NOW }),
    ).toEqual({ ok: false, code: "ROOM_EXPIRED" });
  });

  it("rooms 24 hours old or more are expired", () => {
    const at = (age: number) => ({ status: "lobby" as const, createdAt: NOW - age });
    expect(isRoomExpired(at(JOIN_WINDOW_MS - 1), NOW)).toBe(false);
    expect(isRoomExpired(at(JOIN_WINDOW_MS), NOW)).toBe(true);
    expect(
      canJoin({ room: at(JOIN_WINDOW_MS + 1), activeCount: 0, maxPlayers: 12, now: NOW }),
    ).toEqual({
      ok: false,
      code: "ROOM_EXPIRED",
    });
  });

  it("expiry wins over started and full", () => {
    const old = { status: "answering" as const, createdAt: NOW - JOIN_WINDOW_MS * 2 };
    expect(canJoin({ room: old, activeCount: 99, maxPlayers: 3, now: NOW })).toMatchObject({
      code: "ROOM_EXPIRED",
    });
  });

  it("accepts ISO strings for times", () => {
    expect(
      canJoin({
        room: { status: "lobby", createdAt: new Date(NOW - 1000).toISOString() },
        activeCount: 0,
        maxPlayers: 12,
        now: new Date(NOW),
      }),
    ).toEqual({ ok: true });
  });
});

describe("submission phases", () => {
  it("allAnswered needs every active player submitted", () => {
    const ps = [
      p("h", 1, { answersSubmittedAt: NOW }),
      p("a", 2, { answersSubmittedAt: NOW }),
      p("b", 3),
    ];
    expect(allAnswered(ps)).toBe(false);
    expect(unfinishedPlayers(ps, "answering").map((x) => x.id)).toEqual(["b"]);
    const satOut = ps.map((x) => (x.id === "b" ? { ...x, status: "sat_out" as const } : x));
    expect(allAnswered(satOut)).toBe(true);
    expect(autoAdvance("answering", satOut)).toBe("guessing");
    expect(autoAdvance("answering", ps)).toBeNull();
  });

  it("allGuessed needs every active player submitted", () => {
    const ps = [p("h", 1, { guessesSubmittedAt: NOW }), p("a", 2)];
    expect(allGuessed(ps)).toBe(false);
    expect(unfinishedPlayers(ps, "guessing").map((x) => x.id)).toEqual(["a"]);
    const done = ps.map((x) => ({ ...x, guessesSubmittedAt: NOW }));
    expect(allGuessed(done)).toBe(true);
    expect(autoAdvance("guessing", done)).toBe("ready");
    expect(autoAdvance("guessing", ps)).toBeNull();
  });

  it("an empty room never counts as done", () => {
    expect(allAnswered([])).toBe(false);
    expect(allGuessed([p("x", 1, { status: "left", guessesSubmittedAt: NOW })])).toBe(false);
  });

  it("ready, lobby and revealed never auto-advance", () => {
    const done = lobby.map((x) => ({ ...x, answersSubmittedAt: NOW, guessesSubmittedAt: NOW }));
    expect(autoAdvance("ready", done)).toBeNull();
    expect(autoAdvance("lobby", done)).toBeNull();
    expect(autoAdvance("revealed", done)).toBeNull();
  });

  it("activePlayers filters by status", () => {
    const ps = [p("a", 1), p("b", 2, { status: "left" }), p("c", 3, { status: "sat_out" })];
    expect(activePlayers(ps).map((x) => x.id)).toEqual(["a"]);
  });
});

describe("finalize guard", () => {
  it("finalizes each round once", () => {
    expect(needsFinalize({ round: 1, finalRound: 0 })).toBe(true);
    expect(needsFinalize({ round: 1, finalRound: 1 })).toBe(false);
    expect(needsFinalize({ round: 2, finalRound: 1 })).toBe(true);
  });
});

describe("host handover", () => {
  it("keeps an active, recently seen host", () => {
    expect(nextHost(lobby, "h", NOW)).toBe("h");
  });

  it("passes to the earliest-joined active player when the host leaves", () => {
    const ps = [
      p("h", 1, { status: "left" }),
      p("b", 3),
      p("a", 2),
      p("c", 0, { status: "removed" }),
    ];
    expect(nextHost(ps, "h", NOW)).toBe("a");
  });

  it("hands hosting back to the creator once they are active again", () => {
    const ps = [p("h", 1), p("a", 2)];
    expect(nextHost(ps, "a", NOW, "h")).toBe("h");
  });

  it("keeps the stand-in host while the creator is away or gone", () => {
    const away = [p("h", 1, { lastSeenAt: NOW - HOST_INACTIVE_MS }), p("a", 2)];
    expect(nextHost(away, "a", NOW, "h")).toBe("a");
    const gone = [p("h", 1, { status: "left" }), p("a", 2)];
    expect(nextHost(gone, "a", NOW, "h")).toBe("a");
  });

  it("passes on after 10 minutes without a heartbeat", () => {
    const ps = [p("h", 1, { lastSeenAt: NOW - HOST_INACTIVE_MS }), p("a", 2), p("b", 3)];
    expect(isHostInactive(ps[0]!, NOW)).toBe(true);
    expect(isHostInactive({ ...ps[0]!, lastSeenAt: NOW - HOST_INACTIVE_MS + 1 }, NOW)).toBe(false);
    expect(nextHost(ps, "h", NOW)).toBe("a");
  });

  it("prefers a player with a recent heartbeat", () => {
    const ps = [
      p("h", 1, { status: "left" }),
      p("a", 2, { lastSeenAt: NOW - HOST_INACTIVE_MS * 2 }),
      p("b", 3),
    ];
    expect(nextHost(ps, "h", NOW)).toBe("b");
  });

  it("falls back to the earliest active player if everyone is idle", () => {
    const idle = NOW - HOST_INACTIVE_MS * 3;
    const ps = [
      p("h", 1, { status: "left" }),
      p("b", 3, { lastSeenAt: idle }),
      p("a", 2, { lastSeenAt: idle }),
    ];
    expect(nextHost(ps, "h", NOW)).toBe("a");
  });

  it("treats a missing heartbeat as fresh", () => {
    expect(isHostInactive(p("h", 1, { lastSeenAt: null }), NOW)).toBe(false);
  });

  it("picks a host when there is none, and null when nobody is left", () => {
    expect(nextHost(lobby, null, NOW)).toBe("h");
    expect(nextHost([p("h", 1, { status: "left" })], "h", NOW)).toBeNull();
    expect(nextHost([], null, NOW)).toBeNull();
  });
});

describe("rematch", () => {
  const players: RematchPlayer[] = [
    {
      ...p("h", 1, { answersSubmittedAt: NOW, guessesSubmittedAt: NOW }),
      spillMode: true,
    },
    {
      ...p("a", 2, { status: "sat_out", answersSubmittedAt: NOW }),
      spillMode: false,
    },
    { ...p("b", 3, { status: "removed" }), spillMode: true },
  ];

  it("returns to the lobby on the next round with submissions and Spill Mode cleared", () => {
    const r = rematch({ status: "revealed", round: 2 }, players);
    expect(r.status).toBe("lobby");
    expect(r.round).toBe(3);
    expect(
      r.players.every((x) => x.answersSubmittedAt === null && x.guessesSubmittedAt === null),
    ).toBe(true);
    expect(r.players.every((x) => !x.spillMode)).toBe(true);
    expect(r.players.map((x) => x.status)).toEqual(["active", "active", "removed"]);
    expect(r.players.map((x) => x.ageBand)).toEqual(["18_plus", "18_plus", "18_plus"]);
  });

  it("age bands carry over to the next round (SPIL-02)", () => {
    const r = rematch({ status: "revealed", round: 1 }, players);
    expect(r.players.map((x) => x.ageBand)).toEqual(players.map((x) => x.ageBand));
  });

  it("only runs from revealed", () => {
    expect(() => rematch({ status: "guessing", round: 1 }, players)).toThrow();
  });

  it("does not mutate the input players", () => {
    rematch({ status: "revealed", round: 1 }, players);
    expect(players[0]!.status).toBe("active");
    expect(players[0]!.spillMode).toBe(true);
  });
});

describe("advancePhaseIfReady plan (SPIL-01)", () => {
  const answered = { answersSubmittedAt: NOW };
  const guessed = { answersSubmittedAt: NOW, guessesSubmittedAt: NOW };
  const satOut = { status: "sat_out" as const };

  it("LMGF: host moved on without the only guest, host is locked and the room waits for the guest", () => {
    const ps = [p("h", 1, answered), p("g", 2, satOut)];
    expect(guessTargets(ps, "h")).toEqual([]);
    expect(guessTargets(ps, "g").map((x) => x.id)).toEqual(["h"]);
    expect(planAdvance("guessing", ps)).toEqual({ lock: ["h"], to: null });
    const guestLocked = [p("h", 1, guessed), p("g", 2, { ...satOut, guessesSubmittedAt: NOW })];
    expect(planAdvance("guessing", guestLocked)).toEqual({ lock: [], to: "ready" });
  });

  it("a player with no targets never holds the room up", () => {
    const ps = [p("h", 1, answered), p("g", 2, { ...satOut, guessesSubmittedAt: NOW })];
    expect(planAdvance("guessing", ps)).toEqual({ lock: ["h"], to: "ready" });
  });

  it("nobody with a score: everyone is locked and guessing ends at once", () => {
    const ps = [p("h", 1, satOut), p("g", 2, satOut)];
    expect(planAdvance("guessing", ps)).toEqual({ lock: ["h", "g"], to: "ready" });
  });

  it("left players are out of targets and out of the wait", () => {
    const ps = [p("h", 1, answered), p("g", 2, { ...answered, status: "left" })];
    expect(planAdvance("guessing", ps)).toEqual({ lock: ["h"], to: "ready" });
  });

  it("3 players: one sat out, the other two guess about each other", () => {
    const ps = [p("h", 1, answered), p("a", 2, answered), p("b", 3, satOut)];
    expect(planAdvance("guessing", ps)).toEqual({ lock: [], to: null });
    const done = [p("h", 1, guessed), p("a", 2, guessed), p("b", 3, satOut)];
    expect(planAdvance("guessing", done)).toEqual({ lock: [], to: null });
    done[2] = p("b", 3, { ...satOut, guessesSubmittedAt: NOW });
    expect(planAdvance("guessing", done)).toEqual({ lock: [], to: "ready" });
  });

  it("3 players: two sat out, the host is locked and waits on them", () => {
    const ps = [p("h", 1, answered), p("a", 2, satOut), p("b", 3, satOut)];
    expect(planAdvance("guessing", ps)).toEqual({ lock: ["h"], to: null });
  });

  it("12 players: everyone answered, waits for the last guesser", () => {
    const ps = Array.from({ length: 12 }, (_, i) => p(`p${i}`, i, i < 11 ? guessed : answered));
    expect(planAdvance("guessing", ps)).toEqual({ lock: [], to: null });
    ps[11] = p("p11", 11, guessed);
    expect(planAdvance("guessing", ps)).toEqual({ lock: [], to: "ready" });
  });

  it("12 players: 11 sat out, the only scored player is locked, the rest still guess", () => {
    const ps = Array.from({ length: 12 }, (_, i) => p(`p${i}`, i, i === 0 ? answered : satOut));
    expect(planAdvance("guessing", ps)).toEqual({ lock: ["p0"], to: null });
  });

  it("answering moves on when every active player answered; sat out players are not waited for", () => {
    expect(planAdvance("answering", [p("h", 1, answered), p("g", 2, satOut)])).toEqual({
      lock: [],
      to: "guessing",
    });
    expect(planAdvance("answering", [p("h", 1, answered), p("g", 2)]).to).toBeNull();
  });

  it("lobby, ready and revealed never move on by themselves", () => {
    const ps = [p("h", 1, guessed), p("g", 2, guessed)];
    for (const status of ["lobby", "ready", "revealed", "closed"] as const)
      expect(planAdvance(status, ps)).toEqual({ lock: [], to: null });
  });

  it("an already locked player is never locked again", () => {
    const ps = [p("h", 1, guessed), p("g", 2, satOut)];
    expect(planAdvance("guessing", ps).lock).toEqual([]);
  });
});

describe("skip to the reveal (SPIL-01)", () => {
  it("opens 60 s into guessing, only while guessing", () => {
    const at = NOW - SKIP_TO_REVEAL_MS;
    expect(canSkipToReveal({ status: "guessing", guessingAt: at }, NOW)).toBe(true);
    expect(canSkipToReveal({ status: "guessing", guessingAt: at + 1 }, NOW)).toBe(false);
    expect(canSkipToReveal({ status: "ready", guessingAt: at }, NOW)).toBe(false);
    expect(canSkipToReveal({ status: "guessing", guessingAt: null }, NOW)).toBe(false);
  });
});

describe("stuck rooms (SPIL-01)", () => {
  it("a live phase untouched for 20 minutes is stuck", () => {
    const old = NOW - STUCK_AFTER_MS;
    for (const status of ["answering", "guessing", "ready"] as const) {
      expect(isStuck({ status, updatedAt: old }, NOW)).toBe(true);
      expect(isStuck({ status, updatedAt: old + 1 }, NOW)).toBe(false);
    }
  });

  it("lobby, revealed and closed rooms are never stuck", () => {
    for (const status of ["lobby", "revealed", "closed"] as const)
      expect(isStuck({ status, updatedAt: 0 }, NOW)).toBe(false);
  });
});
