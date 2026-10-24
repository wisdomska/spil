/**
 * API integration tests against a running app and a real Supabase project (local in CI, or
 * spil-preview). Run with API_BASE_URL set: `pnpm test:api`. Skipped otherwise.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { anonPlayer, BASE, code, enabled, type Player } from "./helpers";

const d = enabled ? describe : describe.skip;

async function fullRoom(n: number, packId = "classic", questionCount = 5) {
  const players = await Promise.all(Array.from({ length: n }, () => anonPlayer()));
  const [host] = players;
  const created = await host!.call("POST", "/rooms", { packId, questionCount });
  expect(created.status).toBe(200);
  const roomCode: string = created.body.code;
  for (const [i, p] of players.entries()) {
    const joined = await p.call("POST", `/rooms/${roomCode}/join`, {
      nickname: `Player ${i + 1}`,
      avatar: i,
      ageConfirmed: true,
    });
    expect(joined.status, JSON.stringify(joined.body)).toBe(200);
  }
  return { players, host: host!, roomCode };
}

async function answerAll(p: Player, roomCode: string, value: (i: number) => "yes" | "no" | "skip") {
  const state = await p.call("GET", `/rooms/${roomCode}/state`);
  const questions: Array<{ id: string }> = state.body.questions;
  const saved = await p.call("PUT", `/rooms/${roomCode}/answers`, {
    answers: questions.map((q, i) => ({ questionId: q.id, value: value(i) })),
  });
  expect(saved.status).toBe(200);
  return p.call("POST", `/rooms/${roomCode}/answers/submit`);
}

async function guessAll(p: Player, roomCode: string, value: number) {
  const state = await p.call("GET", `/rooms/${roomCode}/state`);
  const others = state.body.players.filter(
    (x: { id: string; status: string }) => x.id !== state.body.me.id && x.status === "active",
  );
  await p.call("PUT", `/rooms/${roomCode}/guesses`, {
    guesses: others.map((o: { id: string }) => ({ targetId: o.id, value })),
  });
  return p.call("POST", `/rooms/${roomCode}/guesses/submit`);
}

d("public endpoints", () => {
  it("GET /api/health", async () => {
    const res = await fetch(`${BASE}/api/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });

  it("GET /packs lists live packs with questions, never drafts", async () => {
    const p = await anonPlayer();
    const res = await p.call("GET", "/packs");
    expect(res.status).toBe(200);
    const ids = res.body.map((x: { id: string }) => x.id);
    expect(ids).toContain("classic");
    expect(ids).not.toContain("purity");
    expect(res.body.every((x: { questionCount: number }) => x.questionCount > 0)).toBe(true);
  });

  it("GET /rooms/:code is 404 for an unknown code", async () => {
    const p = await anonPlayer();
    const res = await p.call("GET", "/rooms/ZZZZ");
    expect(res.status).toBe(404);
    expect(code(res)).toBe("ROOM_NOT_FOUND");
  });

  it("rejects calls without a session", async () => {
    const res = await fetch(`${BASE}/api/v1/rooms`, { method: "POST", body: "{}" });
    expect(res.status).toBe(401);
  });

  it("validates bodies", async () => {
    const p = await anonPlayer();
    const res = await p.call("POST", "/rooms", { packId: 12 });
    expect(code(res)).toBe("BAD_REQUEST");
  });

  it("POST /rooms rejects a draft pack", async () => {
    const p = await anonPlayer();
    const res = await p.call("POST", "/rooms", { packId: "purity" });
    expect(code(res)).toBe("PACK_UNAVAILABLE");
  });

  it("POST /messages stores a contact message", async () => {
    const res = await fetch(`${BASE}/api/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: "Integration test message, please ignore." }),
    });
    expect(res.status).toBe(200);
  });
});

d("a full game with 3 players", () => {
  let room: Awaited<ReturnType<typeof fullRoom>>;
  beforeAll(async () => {
    room = await fullRoom(3);
  });

  it("first joiner is host; preview shows the room", async () => {
    const preview = await room.players[1]!.call("GET", `/rooms/${room.roomCode}`);
    expect(preview.body).toMatchObject({
      status: "lobby",
      playerCount: 3,
      hostNickname: "Player 1",
    });
    const state = await room.host.call("GET", `/rooms/${room.roomCode}/state`);
    expect(state.body.me.isHost).toBe(true);
    expect(state.body.players).toHaveLength(3);
  });

  it("only the host can start; nicknames are unique", async () => {
    const guest = room.players[1]!;
    expect(code(await guest.call("POST", `/rooms/${room.roomCode}/start`))).toBe("NOT_HOST");
    const late = await anonPlayer();
    const dup = await late.call("POST", `/rooms/${room.roomCode}/join`, {
      nickname: "player 2",
      avatar: 3,
    });
    expect(code(dup)).toBe("NAME_TAKEN");
    const rude = await late.call("POST", `/rooms/${room.roomCode}/join`, {
      nickname: "Sh1t head",
      avatar: 3,
    });
    expect(code(rude)).toBe("NAME_INVALID");
  });

  it("starts, answers privately, and moves to guessing when all submit", async () => {
    const started = await room.host.call("POST", `/rooms/${room.roomCode}/start`);
    expect(started.status).toBe(200);
    expect(started.body.room.status).toBe("answering");
    expect(started.body.questions).toHaveLength(5);

    const late = await anonPlayer();
    const tooLate = await late.call("POST", `/rooms/${room.roomCode}/join`, {
      nickname: "Late",
      avatar: 1,
    });
    expect(code(tooLate)).toBe("GAME_STARTED");

    // Incomplete submit is refused.
    expect(code(await room.host.call("POST", `/rooms/${room.roomCode}/answers/submit`))).toBe(
      "INCOMPLETE",
    );

    await answerAll(room.players[0]!, room.roomCode, (i) => (i < 4 ? "yes" : "no"));
    await answerAll(room.players[1]!, room.roomCode, (i) => (i < 1 ? "yes" : "no"));
    const last = await answerAll(room.players[2]!, room.roomCode, () => "no");
    expect(last.body.room.status).toBe("guessing");

    // Another player's answers are never in my state.
    const mine = await room.players[1]!.call("GET", `/rooms/${room.roomCode}/state`);
    expect(mine.body.myAnswers).toBeUndefined();
    expect(JSON.stringify(mine.body)).not.toContain('"yes"');
  });

  it("guesses, refuses self-guesses, reaches ready, reveals once", async () => {
    const self = await room.host.call("GET", `/rooms/${room.roomCode}/state`);
    const bad = await room.host.call("PUT", `/rooms/${room.roomCode}/guesses`, {
      guesses: [{ targetId: self.body.me.id, value: 50 }],
    });
    expect(code(bad)).toBe("INVALID_TARGET");

    for (const p of room.players) await guessAll(p, room.roomCode, 40);
    const ready = await room.host.call("GET", `/rooms/${room.roomCode}/state`);
    expect(ready.body.room.status).toBe("ready");

    const revealed = await room.host.call("POST", `/rooms/${room.roomCode}/advance`, {
      from: "ready",
    });
    expect(revealed.body.room.status).toBe("revealed");
    expect(revealed.body.results.rows).toHaveLength(3);
    // Three players: awards are given, but Clueless needs 5 or more (SRS 4.3).
    const awardIds = revealed.body.results.awards.map((x: { award: string }) => x.award);
    expect(awardIds).toContain("top_spiller");
    expect(awardIds).not.toContain("clueless");
    expect(revealed.body.results.rows[0].score).toBe(80);

    // Second reveal is refused (phase moved), results unchanged.
    const again = await room.host.call("POST", `/rooms/${room.roomCode}/advance`, {
      from: "ready",
    });
    expect(code(again)).toBe("WRONG_PHASE");
  });

  it("Spill Mode names only opted-in players in question stats", async () => {
    await room.players[0]!.call("PATCH", `/rooms/${room.roomCode}/me`, { spillMode: true });
    const state = await room.players[2]!.call("GET", `/rooms/${room.roomCode}/state`);
    const names = state.body.results.questionStats.flatMap(
      (q: { spillNames: string[] }) => q.spillNames,
    );
    expect(names.every((n: string) => n === "Player 1")).toBe(true);
  });

  it("rematch returns everyone to the lobby with the same code", async () => {
    const res = await room.host.call("POST", `/rooms/${room.roomCode}/rematch`, {
      packId: "campus",
    });
    expect(res.body.room.status).toBe("lobby");
    expect(res.body.room.pack.id).toBe("campus");
    expect(res.body.room.code).toBe(room.roomCode);
    const started = await room.host.call("POST", `/rooms/${room.roomCode}/start`);
    expect(started.body.room.round).toBe(2);
    expect(started.body.myAnswers).toEqual({});
  });
});

d("host tools", () => {
  it("force advance marks unfinished players sat_out", async () => {
    const room = await fullRoom(3);
    await room.host.call("POST", `/rooms/${room.roomCode}/start`);
    await answerAll(room.players[0]!, room.roomCode, () => "yes");
    await answerAll(room.players[1]!, room.roomCode, () => "no");
    const forced = await room.host.call("POST", `/rooms/${room.roomCode}/advance`, {
      from: "answering",
    });
    expect(forced.body.room.status).toBe("guessing");
    expect(
      forced.body.players.find((p: { nickname: string }) => p.nickname === "Player 3").status,
    ).toBe("sat_out");
  });

  it("kick, leave and host handover", async () => {
    const room = await fullRoom(3);
    const state = await room.host.call("GET", `/rooms/${room.roomCode}/state`);
    const target = state.body.players.find((p: { nickname: string }) => p.nickname === "Player 3");
    const kicked = await room.host.call("POST", `/rooms/${room.roomCode}/kick`, {
      playerId: target.id,
    });
    expect(kicked.body.players).toHaveLength(2);
    const gone = await room.players[2]!.call("GET", `/rooms/${room.roomCode}/state`);
    expect(gone.body.error.message).toBe("REMOVED");

    expect((await room.host.call("DELETE", `/rooms/${room.roomCode}/me`)).status).toBe(200);
    const after = await room.players[1]!.call("GET", `/rooms/${room.roomCode}/state`);
    expect(after.body.me.isHost).toBe(true);
  });

  it("start needs the minimum players", async () => {
    const host = await anonPlayer();
    const created = await host.call("POST", "/rooms", { packId: "classic" });
    await host.call("POST", `/rooms/${created.body.code}/join`, { nickname: "Solo", avatar: 0 });
    expect(code(await host.call("POST", `/rooms/${created.body.code}/start`))).toBe(
      "NOT_ENOUGH_PLAYERS",
    );
  });

  it("two players are enough to start", async () => {
    const room = await fullRoom(2);
    expect((await room.host.call("POST", `/rooms/${room.roomCode}/start`)).status).toBe(200);
  });

  it("adult packs need everyone's 18+ confirmation", async () => {
    const room = await fullRoom(3);
    await room.host.call("PATCH", `/rooms/${room.roomCode}/pack`, { packId: "afterdark" });
    expect(code(await room.host.call("POST", `/rooms/${room.roomCode}/start`))).toBe("AGE_PENDING");
    for (const p of room.players.slice(1))
      await p.call("POST", `/rooms/${room.roomCode}/confirm-age`);
    const started = await room.host.call("POST", `/rooms/${room.roomCode}/start`);
    expect(started.body.room.status).toBe("answering");
  });

  it("joining an adult room requires ageConfirmed", async () => {
    const host = await anonPlayer();
    const created = await host.call("POST", "/rooms", { packId: "afterdark" });
    const res = await host.call("POST", `/rooms/${created.body.code}/join`, {
      nickname: "Ama",
      avatar: 0,
    });
    expect(code(res)).toBe("AGE_REQUIRED");
  });

  it("test players fill the room and play themselves", async () => {
    const host = await anonPlayer();
    const created = await host.call("POST", "/rooms", { packId: "classic", questionCount: 5 });
    const roomCode = created.body.code;
    await host.call("POST", `/rooms/${roomCode}/join`, { nickname: "Host", avatar: 0 });
    const added = await host.call("POST", `/rooms/${roomCode}/test-players`, { count: 2 });
    if (added.status === 403) return; // flag off on this environment
    expect(added.body.players).toHaveLength(3);
    await host.call("POST", `/rooms/${roomCode}/start`);
    const afterAnswers = await answerAll(host, roomCode, () => "yes");
    expect(afterAnswers.body.room.status).toBe("guessing");
    const done = await guessAll(host, roomCode, 50);
    expect(done.body.room.status).toBe("ready");
  });
});
