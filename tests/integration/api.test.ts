/**
 * API integration tests against a running app and a real Supabase project (local in CI, or
 * spil-preview). Run with API_BASE_URL set: `pnpm test:api`. Skipped otherwise.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { anonPlayer, BASE, code, enabled, type Player } from "./helpers";

const d = enabled ? describe : describe.skip;

async function fullRoom(n: number, packId = "classic", questionCount = 5, mode = "classic") {
  const players = await Promise.all(Array.from({ length: n }, () => anonPlayer()));
  const [host] = players;
  const created = await host!.call("POST", "/rooms", {
    ageBand: "18_plus",
    packId,
    questionCount,
    mode,
  });
  expect(created.status).toBe(200);
  const roomCode: string = created.body.code;
  for (const [i, p] of players.entries()) {
    const joined = await p.call("POST", `/rooms/${roomCode}/join`, {
      ageBand: "18_plus",
      nickname: `Player ${i + 1}`,
      avatar: i,
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
    const res = await p.call("POST", "/rooms", { ageBand: "18_plus", packId: 12 });
    expect(code(res)).toBe("BAD_REQUEST");
  });

  it("POST /rooms rejects a draft pack", async () => {
    const p = await anonPlayer();
    const res = await p.call("POST", "/rooms", { ageBand: "18_plus", packId: "purity" });
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
      ageBand: "18_plus",
      nickname: "player 2",
      avatar: 3,
    });
    expect(code(dup)).toBe("NAME_TAKEN");
    const rude = await late.call("POST", `/rooms/${room.roomCode}/join`, {
      ageBand: "18_plus",
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
      ageBand: "18_plus",
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
    // Ranked by guessing: everyone guessed 40, so the 80 and the 0 player tie at 70 points
    // and share first place; the higher Spill Score lists first.
    const firsts = revealed.body.results.rows.filter((r: { rank: number }) => r.rank === 1);
    expect(firsts.map((r: { score: number }) => r.score)).toEqual([80, 0]);

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

  it("a solo room starts with one player and skips guessing", async () => {
    const host = await anonPlayer();
    const created = await host.call("POST", "/rooms", {
      ageBand: "18_plus",
      packId: "classic",
      questionCount: 5,
    });
    const roomCode = created.body.code;
    await host.call("POST", `/rooms/${roomCode}/join`, {
      ageBand: "18_plus",
      nickname: "Solo",
      avatar: 0,
    });
    expect((await host.call("POST", `/rooms/${roomCode}/start`)).status).toBe(200);
    const done = await answerAll(host, roomCode, () => "yes");
    expect(done.body.room.status).toBe("ready");
  });

  it("Room Percentage: needs 3, guesses only questions 3 answered, scores the room share", async () => {
    const host = await anonPlayer();
    const notBuilt = await host.call("POST", "/rooms", {
      ageBand: "18_plus",
      packId: "classic",
      mode: "poker",
    });
    expect(notBuilt.status).toBe(400);

    const pair = await fullRoom(2, "classic", 5, "room_percentage");
    const lobby = await pair.host.call("GET", `/rooms/${pair.roomCode}/state`);
    expect(lobby.body.room.mode).toBe("room_percentage");
    expect(lobby.body.room.settings.minPlayers).toBeGreaterThanOrEqual(3);
    expect(code(await pair.host.call("POST", `/rooms/${pair.roomCode}/start`))).toBe(
      "NOT_ENOUGH_PLAYERS",
    );

    const room = await fullRoom(3, "classic", 5, "room_percentage");
    const [a, b, c] = room.players as [Player, Player, Player];
    expect((await a.call("POST", `/rooms/${room.roomCode}/start`)).status).toBe(200);
    await answerAll(a, room.roomCode, () => "yes");
    await answerAll(b, room.roomCode, (i) => (i < 2 ? "yes" : "no"));
    const moved = await answerAll(c, room.roomCode, (i) => (i < 4 ? "no" : "skip"));
    expect(moved.body.room.status).toBe("guessing");

    // The fifth question has 2 answers, so nobody guesses it (it would give answers away).
    const state = await a.call("GET", `/rooms/${room.roomCode}/state`);
    const qs: Array<{ id: string }> = state.body.percentQuestions;
    expect(qs).toHaveLength(4);
    expect(state.body.me.targets).toEqual(qs.map((q) => q.id));
    // Nobody's answers are in anyone's state.
    expect(JSON.stringify(state.body)).not.toContain('"yes"');
    expect(code(await a.call("POST", `/rooms/${room.roomCode}/guesses/submit`))).toBe("INCOMPLETE");
    const stray = await a.call("PUT", `/rooms/${room.roomCode}/guesses`, {
      guesses: [{ targetId: state.body.players[1].id, value: 50 }],
    });
    expect(stray.status).toBeGreaterThanOrEqual(400);

    // Real shares: 67, 67, 33, 33. a is exact, b says 50, c says 0.
    const shares = [67, 67, 33, 33];
    const put = (p: Player, value: (i: number) => number) =>
      p.call("PUT", `/rooms/${room.roomCode}/percent`, {
        guesses: qs.map((q, i) => ({ questionId: q.id, value: value(i) })),
      });
    expect((await put(a, (i) => shares[i]!)).status).toBe(200);
    expect((await put(b, () => 50)).status).toBe(200);
    expect((await put(c, () => 0)).status).toBe(200);
    for (const p of [a, b, c])
      expect((await p.call("POST", `/rooms/${room.roomCode}/guesses/submit`)).status).toBe(200);

    const revealed = await a.call("POST", `/rooms/${room.roomCode}/advance`, { from: "ready" });
    expect(revealed.body.room.status).toBe("revealed");
    const percent: Array<{ actual: number; guesses: Array<{ points: number; closest: boolean }> }> =
      revealed.body.results.percent;
    expect(percent.map((q) => q.actual)).toEqual(shares);
    const top = revealed.body.results.rows[0];
    expect(top.playerId).toBe(state.body.me.id);
    // Exact (10) and closest (+3) on each of the 4 questions.
    expect(top.mindReader).toBe(52);
    expect(revealed.body.room.reveal.total).toBe(4 + revealed.body.results.awards.length);
    const awardIds = revealed.body.results.awards.map((x: { award: string }) => x.award);
    expect(awardIds).not.toContain("open_book");
    expect(awardIds).not.toContain("dark_horse");
  });

  it("Hot Takes: statement packs only, private ratings, guesses of the room's average", async () => {
    const host = await anonPlayer();
    const wrongPack = await host.call("POST", "/rooms", {
      ageBand: "18_plus",
      packId: "classic",
      mode: "hot_takes",
    });
    expect(code(wrongPack)).toBe("PACK_NOT_ALLOWED");
    const wrongMode = await host.call("POST", "/rooms", {
      ageBand: "18_plus",
      packId: "hot_takes",
    });
    expect(code(wrongMode)).toBe("PACK_NOT_ALLOWED");

    const room = await fullRoom(3, "hot_takes", 5, "hot_takes");
    const [a, b, c] = room.players as [Player, Player, Player];
    const switchable = await a.call("GET", `/rooms/${room.roomCode}/packs`);
    expect(switchable.body.packs.map((p: { id: string }) => p.id)).toEqual(["hot_takes"]);
    expect((await a.call("POST", `/rooms/${room.roomCode}/start`)).status).toBe(200);

    const state = await a.call("GET", `/rooms/${room.roomCode}/state`);
    const qs: Array<{ id: string }> = state.body.questions;
    expect(qs).toHaveLength(5);
    const yesNo = await a.call("PUT", `/rooms/${room.roomCode}/answers`, {
      answers: [{ questionId: qs[0]!.id, value: "yes" }],
    });
    expect(code(yesNo)).toBe("WRONG_PHASE");
    expect(code(await a.call("POST", `/rooms/${room.roomCode}/answers/submit`))).toBe("INCOMPLETE");

    // Every statement averages 50: 80, 60 and 10.
    const rate = (p: Player, value: number) =>
      p.call("PUT", `/rooms/${room.roomCode}/ratings`, {
        ratings: qs.map((q) => ({ questionId: q.id, value })),
      });
    const saved = await rate(a, 80);
    expect(saved.body.answered).toBe(5);
    await rate(b, 60);
    await rate(c, 10);
    const mine = await a.call("GET", `/rooms/${room.roomCode}/state`);
    expect(Object.values(mine.body.myRatings)).toEqual([80, 80, 80, 80, 80]);
    expect(mine.body.players.find((p: { id: string }) => p.id !== mine.body.me.id).answered).toBe(
      5,
    );
    for (const p of [a, b, c])
      expect((await p.call("POST", `/rooms/${room.roomCode}/answers/submit`)).status).toBe(200);

    const guessing = await b.call("GET", `/rooms/${room.roomCode}/state`);
    expect(guessing.body.room.status).toBe("guessing");
    expect(guessing.body.percentQuestions).toHaveLength(5);
    // Nobody's ratings are in anyone's state.
    expect(JSON.stringify(guessing.body)).not.toContain("myRatings");

    const guess = (p: Player, value: number) =>
      p.call("PUT", `/rooms/${room.roomCode}/percent`, {
        guesses: qs.map((q) => ({ questionId: q.id, value })),
      });
    await guess(a, 50);
    await guess(b, 70);
    await guess(c, 0);
    for (const p of [a, b, c])
      expect((await p.call("POST", `/rooms/${room.roomCode}/guesses/submit`)).status).toBe(200);

    const revealed = await a.call("POST", `/rooms/${room.roomCode}/advance`, { from: "ready" });
    expect(revealed.body.room.status).toBe("revealed");
    expect(revealed.body.results.percent.map((q: { actual: number }) => q.actual)).toEqual([
      50, 50, 50, 50, 50,
    ]);
    expect(revealed.body.results.rows[0].mindReader).toBe(65);
    const cState = await c.call("GET", `/rooms/${room.roomCode}/state`);
    expect(revealed.body.results.hottest[cState.body.me.id]).toMatchObject({
      rating: 10,
      average: 50,
    });
    for (const x of revealed.body.results.awards)
      expect(["mind_reader", "clueless"]).toContain(x.award);
  });

  it("Most Likely To: secret votes for others, no guessing, counts only", async () => {
    const host = await anonPlayer();
    const wrongPack = await host.call("POST", "/rooms", {
      ageBand: "18_plus",
      packId: "hot_takes",
      mode: "most_likely",
    });
    expect(code(wrongPack)).toBe("PACK_NOT_ALLOWED");

    const room = await fullRoom(3, "most_likely", 5, "most_likely");
    const [a, b, c] = room.players as [Player, Player, Player];
    expect((await a.call("POST", `/rooms/${room.roomCode}/start`)).status).toBe(200);
    const state = await a.call("GET", `/rooms/${room.roomCode}/state`);
    const qs: Array<{ id: string }> = state.body.questions;
    const id = (p: Player) =>
      p.call("GET", `/rooms/${room.roomCode}/state`).then((s) => s.body.me.id);
    const [aId, bId, cId] = await Promise.all([id(a), id(b), id(c)]);

    const vote = (p: Player, pick: (i: number) => string) =>
      p.call("PUT", `/rooms/${room.roomCode}/votes`, {
        votes: qs.map((q, i) => ({ questionId: q.id, targetId: pick(i) })),
      });
    expect(code(await vote(a, () => aId))).toBe("INVALID_TARGET");
    expect(code(await a.call("POST", `/rooms/${room.roomCode}/answers/submit`))).toBe("INCOMPLETE");
    // First vote for c, then change to b: one vote per prompt.
    await vote(a, () => cId);
    expect((await vote(a, () => bId)).body.answered).toBe(5);
    await vote(b, () => cId);
    await vote(c, () => bId);
    for (const p of [a, b, c])
      expect((await p.call("POST", `/rooms/${room.roomCode}/answers/submit`)).status).toBe(200);

    // Nothing to guess: straight to Lights down.
    const ready = await a.call("GET", `/rooms/${room.roomCode}/state`);
    expect(ready.body.room.status).toBe("ready");
    const revealed = await a.call("POST", `/rooms/${room.roomCode}/advance`, { from: "ready" });
    expect(revealed.body.room.status).toBe("revealed");
    const likely = revealed.body.results.likely;
    expect(likely).toHaveLength(5);
    // b has 2 votes (a and c), c has 1 (b).
    expect(likely[0].top).toEqual([bId]);
    expect(likely[0].tally).toEqual([
      { playerId: bId, count: 2 },
      { playerId: cId, count: 1 },
    ]);
    expect(revealed.body.results.crowned[bId]).toMatchObject({ count: 2, voters: 3 });
    const pts = Object.fromEntries(
      revealed.body.results.rows.map((r: { playerId: string; mindReader: number }) => [
        r.playerId,
        r.mindReader,
      ]),
    );
    expect(pts).toEqual({ [aId]: 50, [bId]: 0, [cId]: 50 });
    expect(revealed.body.room.reveal.total).toBe(5 + revealed.body.results.awards.length);
    // Who voted for whom is never sent.
    expect(JSON.stringify(revealed.body)).not.toContain("myVotes");
    expect(JSON.stringify(revealed.body.results.likely)).not.toContain(aId);
  });

  it("Red Flag, Green Flag: green or red swipes, no guessing, splits only", async () => {
    const host = await anonPlayer();
    const wrongPack = await host.call("POST", "/rooms", {
      ageBand: "18_plus",
      packId: "classic",
      mode: "red_green",
    });
    expect(code(wrongPack)).toBe("PACK_NOT_ALLOWED");

    const room = await fullRoom(3, "red_green", 5, "red_green");
    const [a, b, c] = room.players as [Player, Player, Player];
    expect((await a.call("POST", `/rooms/${room.roomCode}/start`)).status).toBe(200);
    const state = await a.call("GET", `/rooms/${room.roomCode}/state`);
    const rating = await a.call("PUT", `/rooms/${room.roomCode}/ratings`, {
      ratings: [{ questionId: state.body.questions[0].id, value: 50 }],
    });
    expect(code(rating)).toBe("WRONG_PHASE");

    // Green, green, red on every scenario: 67% green.
    await answerAll(a, room.roomCode, () => "yes");
    await answerAll(b, room.roomCode, () => "yes");
    const last = await answerAll(c, room.roomCode, () => "no");
    expect(last.status).toBe(200);
    const ready = await a.call("GET", `/rooms/${room.roomCode}/state`);
    expect(ready.body.room.status).toBe("ready");

    const revealed = await a.call("POST", `/rooms/${room.roomCode}/advance`, { from: "ready" });
    const flags = revealed.body.results.flags;
    expect(flags).toHaveLength(5);
    expect(flags[0]).toMatchObject({ green: 2, red: 1, greenShare: 67, verdict: "green" });
    const cId = (await c.call("GET", `/rooms/${room.roomCode}/state`)).body.me.id;
    expect(revealed.body.results.lone[cId]).toMatchObject({ side: "red", against: 67 });
    expect(
      revealed.body.results.rows.find((r: { playerId: string }) => r.playerId === cId),
    ).toMatchObject({ mindReader: 0 });
    expect(revealed.body.results.rows[0].mindReader).toBe(50);
    expect(revealed.body.room.reveal.total).toBe(5 + revealed.body.results.awards.length);
  });

  it("Rank the Room: whole-room orders, averaged, no guessing, scored on closeness", async () => {
    const room = await fullRoom(3, "most_likely", 5, "rank_room");
    const [a, b, c] = room.players as [Player, Player, Player];
    expect((await a.call("POST", `/rooms/${room.roomCode}/start`)).status).toBe(200);
    const state = await a.call("GET", `/rooms/${room.roomCode}/state`);
    const qs: Array<{ id: string }> = state.body.questions;
    const id = (p: Player) =>
      p.call("GET", `/rooms/${room.roomCode}/state`).then((s) => s.body.me.id);
    const [aId, bId, cId] = await Promise.all([id(a), id(b), id(c)]);

    const rank = (p: Player, order: string[]) =>
      p.call("PUT", `/rooms/${room.roomCode}/ranks`, {
        ranks: qs.map((q) => ({ questionId: q.id, order })),
      });
    expect(code(await rank(a, [aId, bId]))).toBe("INVALID_TARGET");
    expect(code(await rank(a, [aId, aId, bId]))).toBe("INVALID_TARGET");
    const vote = await a.call("PUT", `/rooms/${room.roomCode}/votes`, {
      votes: [{ questionId: qs[0]!.id, targetId: bId }],
    });
    expect(code(vote)).toBe("WRONG_PHASE");
    // a ranks twice: the second order replaces the first and still counts 5 prompts.
    await rank(a, [cId, bId, aId]);
    expect((await rank(a, [aId, bId, cId])).body.answered).toBe(5);
    await rank(b, [aId, bId, cId]);
    await rank(c, [cId, bId, aId]);
    for (const p of [a, b, c])
      expect((await p.call("POST", `/rooms/${room.roomCode}/answers/submit`)).status).toBe(200);

    const ready = await a.call("GET", `/rooms/${room.roomCode}/state`);
    expect(ready.body.room.status).toBe("ready");
    const revealed = await a.call("POST", `/rooms/${room.roomCode}/advance`, { from: "ready" });
    const ranked = revealed.body.results.ranked;
    expect(ranked).toHaveLength(5);
    expect(
      ranked[0].order.map((p: { playerId: string; place: number }) => [p.playerId, p.place]),
    ).toEqual([
      [aId, 1],
      [bId, 2],
      [cId, 3],
    ]);
    const pts = Object.fromEntries(
      revealed.body.results.rows.map((r: { playerId: string; mindReader: number }) => [
        r.playerId,
        r.mindReader,
      ]),
    );
    expect(pts).toEqual({ [aId]: 35, [bId]: 35, [cId]: 15 });
    expect(revealed.body.results.best[aId]).toMatchObject({ place: 1 });
    expect(revealed.body.room.reveal.total).toBe(5 + revealed.body.results.awards.length);
    expect(JSON.stringify(revealed.body)).not.toContain("myRanks");
  });

  it("Imposter: one secret player gets other questions, the room votes, the reveal names them", async () => {
    const room = await fullRoom(3, "imposter", 5, "imposter");
    const players = room.players as [Player, Player, Player];
    expect((await players[0].call("POST", `/rooms/${room.roomCode}/start`)).status).toBe(200);
    const states = await Promise.all(
      players.map((p) => p.call("GET", `/rooms/${room.roomCode}/state`)),
    );
    // Exactly one phone shows different questions, and nothing in any state says who.
    const firsts = states.map((s) => s.body.questions[0].text as string);
    const odd = firsts.findIndex((t) => firsts.filter((x) => x === t).length === 1);
    expect(odd).toBeGreaterThanOrEqual(0);
    expect(firsts.filter((t) => t !== firsts[odd])).toHaveLength(2);
    for (const s of states) expect(JSON.stringify(s.body)).not.toMatch(/imposter"?:|alt_?text/i);
    const ids = states.map((s) => s.body.me.id as string);
    const imposterId = ids[odd]!;
    const crew = players.filter((_, i) => i !== odd);
    const imp = players[odd]!;

    for (const p of players) {
      const s = await p.call("GET", `/rooms/${room.roomCode}/state`);
      await p.call("PUT", `/rooms/${room.roomCode}/ratings`, {
        ratings: s.body.questions.map((q: { id: string }) => ({ questionId: q.id, value: 60 })),
      });
      expect((await p.call("POST", `/rooms/${room.roomCode}/answers/submit`)).status).toBe(200);
    }
    const voting = await crew[0]!.call("GET", `/rooms/${room.roomCode}/state`);
    expect(voting.body.room.status).toBe("guessing");
    expect(voting.body.board).toHaveLength(5);
    expect(voting.body.board[0].answers).toHaveLength(3);
    expect(JSON.stringify(voting.body.board)).not.toContain("altText");
    expect(JSON.stringify(voting.body.board)).not.toContain(firsts[odd]);

    expect(code(await crew[0]!.call("POST", `/rooms/${room.roomCode}/guesses/submit`))).toBe(
      "INCOMPLETE",
    );
    const self = await crew[0]!.call("PUT", `/rooms/${room.roomCode}/suspect`, {
      targetId: ids[players.indexOf(crew[0]!)],
    });
    expect(code(self)).toBe("INVALID_TARGET");
    // The crew both vote for the imposter (one changes their mind first); the imposter votes crew.
    await crew[0]!.call("PUT", `/rooms/${room.roomCode}/suspect`, {
      targetId: ids[players.indexOf(crew[1]!)],
    });
    await crew[0]!.call("PUT", `/rooms/${room.roomCode}/suspect`, { targetId: imposterId });
    await crew[1]!.call("PUT", `/rooms/${room.roomCode}/suspect`, { targetId: imposterId });
    await imp.call("PUT", `/rooms/${room.roomCode}/suspect`, {
      targetId: ids[players.indexOf(crew[0]!)],
    });
    for (const p of players)
      expect((await p.call("POST", `/rooms/${room.roomCode}/guesses/submit`)).status).toBe(200);

    const revealed = await players[0].call("POST", `/rooms/${room.roomCode}/advance`, {
      from: "ready",
    });
    expect(revealed.status).toBe(200);
    const outcome = revealed.body.results.imposter;
    expect(outcome).toMatchObject({ imposterId, caught: true, top: [imposterId], voters: 3 });
    expect(outcome.board[0].altText).toBe(firsts[odd]);
    const pts = Object.fromEntries(
      revealed.body.results.rows.map((r: { playerId: string; mindReader: number }) => [
        r.playerId,
        r.mindReader,
      ]),
    );
    expect(pts[imposterId]).toBe(0);
    for (const id of ids.filter((x) => x !== imposterId)) expect(pts[id]).toBe(10);
    expect(revealed.body.room.reveal.total).toBe(2 + revealed.body.results.awards.length);
  });

  it("Two Truths: cards from your own answers, spots, points for spotting and fooling", async () => {
    const room = await fullRoom(3, "classic", 5, "two_truths");
    const [a, b, c] = room.players as [Player, Player, Player];
    expect((await a.call("POST", `/rooms/${room.roomCode}/start`)).status).toBe(200);
    const qs: Array<{ id: string }> = (await a.call("GET", `/rooms/${room.roomCode}/state`)).body
      .questions;
    const save = (p: Player, values: string) =>
      p.call("PUT", `/rooms/${room.roomCode}/answers`, {
        answers: qs.map((q, i) => ({ questionId: q.id, value: values[i] === "Y" ? "yes" : "no" })),
      });
    await save(a, "YYNYN");
    await save(b, "YYNYN");
    await save(c, "YYYYY");
    const pick = (p: Player, t: number[], s: number) =>
      p.call("PUT", `/rooms/${room.roomCode}/pick`, {
        truths: t.map((i) => qs[i]!.id),
        spill: qs[s]!.id,
      });
    expect(code(await pick(a, [0, 2], 1))).toBe("INVALID_PICK");
    expect(code(await a.call("POST", `/rooms/${room.roomCode}/answers/submit`))).toBe("INCOMPLETE");
    expect((await pick(a, [0, 1], 2)).status).toBe(200);
    expect((await pick(b, [0, 3], 4)).status).toBe(200);
    // c said yes to everything, so has no card and can still lock in.
    for (const p of [a, b, c])
      expect((await p.call("POST", `/rooms/${room.roomCode}/answers/submit`)).status).toBe(200);

    const ids = await Promise.all(
      [a, b, c].map((p) =>
        p.call("GET", `/rooms/${room.roomCode}/state`).then((s) => s.body.me.id),
      ),
    );
    const [aId, bId] = ids as [string, string, string];
    const guessing = await c.call("GET", `/rooms/${room.roomCode}/state`);
    expect(guessing.body.room.status).toBe("guessing");
    expect(guessing.body.cards.map((x: { playerId: string }) => x.playerId).sort()).toEqual(
      [aId, bId].sort(),
    );
    expect(JSON.stringify(guessing.body.cards)).not.toContain("spill");

    const spot = (p: Player, spots: Array<[string, number]>) =>
      p.call("PUT", `/rooms/${room.roomCode}/spots`, {
        spots: spots.map(([targetId, i]) => ({ targetId, questionId: qs[i]!.id })),
      });
    expect(code(await spot(a, [[aId, 2]]))).toBe("INVALID_TARGET");
    await spot(c, [[aId, 2]]);
    expect(code(await c.call("POST", `/rooms/${room.roomCode}/guesses/submit`))).toBe("INCOMPLETE");
    await spot(c, [[bId, 0]]);
    await spot(a, [[bId, 4]]);
    await spot(b, [[aId, 0]]);
    for (const p of [a, b, c])
      expect((await p.call("POST", `/rooms/${room.roomCode}/guesses/submit`)).status).toBe(200);

    const revealed = await a.call("POST", `/rooms/${room.roomCode}/advance`, { from: "ready" });
    const pts = Object.fromEntries(
      revealed.body.results.rows.map((r: { playerId: string; mindReader: number }) => [
        r.playerId,
        r.mindReader,
      ]),
    );
    // a: spotted b (10) and fooled b (5). b: fooled c (5). c: spotted a (10).
    expect(pts).toEqual({ [aId]: 15, [bId]: 5, [ids[2]!]: 10 });
    const cardA = revealed.body.results.cards.find((x: { playerId: string }) => x.playerId === aId);
    expect(cardA).toMatchObject({ spill: qs[2]!.id, guessers: 2, fooled: 1 });
    expect(revealed.body.room.reveal.total).toBe(2 + revealed.body.results.awards.length);
  });

  it("Who Said That?: 18+ only, filtered answers, anonymous guessing, report hides", async () => {
    const teen = await anonPlayer();
    const young = await teen.call("POST", "/rooms", {
      ageBand: "16_17",
      packId: "who_said",
      mode: "who_said",
    });
    expect(code(young)).toBe("MODE_UNAVAILABLE");

    const room = await fullRoom(3, "who_said", 10, "who_said");
    const players = room.players as [Player, Player, Player];
    const [a] = players;
    expect((await a.call("POST", `/rooms/${room.roomCode}/start`)).status).toBe(200);
    const state = await a.call("GET", `/rooms/${room.roomCode}/state`);
    const qs: Array<{ id: string }> = state.body.questions;
    expect(qs).toHaveLength(5);
    expect(state.body.room.questionCount).toBe(5);

    const write = (p: Player, body: string, q = qs[0]!.id) =>
      p.call("PUT", `/rooms/${room.roomCode}/texts`, { texts: [{ questionId: q, body }] });
    expect(code(await write(a, "what a f4g move"))).toBe("TEXT_BLOCKED");
    expect(code(await write(a, "dm me at ama@example.com"))).toBe("TEXT_CONTACT");
    expect((await write(a, "that was shit")).body.saved[qs[0]!.id]).toBe("that was s***");

    const ids = await Promise.all(
      players.map((p) =>
        p.call("GET", `/rooms/${room.roomCode}/state`).then((s) => s.body.me.id as string),
      ),
    );
    for (const [i, p] of players.entries())
      for (const q of qs)
        expect((await write(p, `Answer from player ${i}`, q.id)).status).toBe(200);
    for (const p of players)
      expect((await p.call("POST", `/rooms/${room.roomCode}/answers/submit`)).status).toBe(200);

    const guessing = await a.call("GET", `/rooms/${room.roomCode}/state`);
    expect(guessing.body.room.status).toBe("guessing");
    const toGuess = guessing.body.toGuess as Array<{
      answers: Array<{ id: string; body: string }>;
    }>;
    expect(toGuess.flatMap((q) => q.answers)).toHaveLength(10);
    expect(JSON.stringify(guessing.body.toGuess)).not.toContain("playerId");
    expect(JSON.stringify(guessing.body.toGuess)).not.toContain("Answer from player 0");

    // Everyone guesses every author right: the answer says who wrote it.
    for (const [i, p] of players.entries()) {
      const s = await p.call("GET", `/rooms/${room.roomCode}/state`);
      const guesses = (s.body.toGuess as Array<{ answers: Array<{ id: string; body: string }> }>)
        .flatMap((q) => q.answers)
        .map((x) => ({ answerId: x.id, authorId: ids[Number(x.body.slice(-1))]! }));
      if (i === 0) {
        const self = await p.call("PUT", `/rooms/${room.roomCode}/whose`, {
          guesses: [{ answerId: guesses[0]!.answerId, authorId: ids[0] }],
        });
        expect(code(self)).toBe("INVALID_TARGET");
      }
      expect((await p.call("PUT", `/rooms/${room.roomCode}/whose`, { guesses })).status).toBe(200);
      expect((await p.call("POST", `/rooms/${room.roomCode}/guesses/submit`)).status).toBe(200);
    }

    const revealed = await a.call("POST", `/rooms/${room.roomCode}/advance`, { from: "ready" });
    expect(revealed.body.room.status).toBe("revealed");
    const pts = revealed.body.results.rows.map((r: { mindReader: number }) => r.mindReader);
    expect(pts).toEqual([100, 100, 100]);
    expect(revealed.body.results.spotted[ids[0]!]).toEqual({ right: 10, total: 10 });

    // A report hides the answer for everyone.
    const target = revealed.body.results.said[0].answers[0];
    const reported = await players[1].call(
      "POST",
      `/rooms/${room.roomCode}/answers/${target.id}/report`,
      {},
    );
    expect(reported.body.hidden).toBe(true);
    const after = await players[2].call("GET", `/rooms/${room.roomCode}/state`);
    const same = after.body.results.said[0].answers.find((x: { id: string }) => x.id === target.id);
    expect(same).toMatchObject({ hidden: true, body: "" });
  });

  it("Spill or Skip: after a classic round, vote for one Spill Mode story; the pick can pass", async () => {
    const room = await fullRoom(3, "classic", 5, "spill_or_skip");
    const [a, b, c] = room.players as [Player, Player, Player];
    expect((await a.call("POST", `/rooms/${room.roomCode}/start`)).status).toBe(200);
    await answerAll(a, room.roomCode, () => "yes");
    await answerAll(b, room.roomCode, () => "yes");
    await answerAll(c, room.roomCode, () => "no");
    for (const p of [a, b, c]) await guessAll(p, room.roomCode, 50);
    const revealed = await a.call("POST", `/rooms/${room.roomCode}/advance`, { from: "ready" });
    expect(revealed.body.room.status).toBe("revealed");
    // Nobody is in Spill Mode yet: nothing to vote for.
    expect(revealed.body.results.spill.options).toEqual([]);

    await a.call("PATCH", `/rooms/${room.roomCode}/me`, { spillMode: true });
    const s = await b.call("GET", `/rooms/${room.roomCode}/state`);
    const aId = (await a.call("GET", `/rooms/${room.roomCode}/state`)).body.me.id;
    const bId = s.body.me.id;
    const options = s.body.results.spill.options as Array<{ questionId: string; playerId: string }>;
    expect(options).toHaveLength(5);
    expect(options.every((o) => o.playerId === aId)).toBe(true);
    // b said yes too but is not in Spill Mode, so cannot be picked.
    const notOpen = await c.call("PUT", `/rooms/${room.roomCode}/spill-vote`, {
      questionId: options[0]!.questionId,
      targetId: bId,
    });
    expect(code(notOpen)).toBe("INVALID_TARGET");

    const pickA = { questionId: options[0]!.questionId, targetId: aId };
    await b.call("PUT", `/rooms/${room.roomCode}/spill-vote`, pickA);
    const after = await c.call("PUT", `/rooms/${room.roomCode}/spill-vote`, pickA);
    await a.call("PUT", `/rooms/${room.roomCode}/spill-vote`, { skip: true });
    expect(after.body.results.spill.pick).toMatchObject({ playerId: aId });
    expect(code(await b.call("PUT", `/rooms/${room.roomCode}/spill-answer`, { spill: true }))).toBe(
      "FORBIDDEN",
    );
    const told = await a.call("PUT", `/rooms/${room.roomCode}/spill-answer`, { spill: false });
    expect(told.body.results.spill).toMatchObject({ answer: "skip", skips: 1, voters: 3 });
  });

  it("Reactions: only during the reveal, only the fixed emoji, rate limited", async () => {
    const room = await fullRoom(2);
    const [a, b] = room.players as [Player, Player];
    const react = (p: Player, emoji: string) =>
      p.call("POST", `/rooms/${room.roomCode}/react`, { emoji });
    expect(code(await react(a, "🔥"))).toBe("WRONG_PHASE");
    await a.call("POST", `/rooms/${room.roomCode}/start`);
    await answerAll(a, room.roomCode, () => "yes");
    await answerAll(b, room.roomCode, () => "no");
    for (const p of [a, b]) await guessAll(p, room.roomCode, 50);
    await a.call("POST", `/rooms/${room.roomCode}/advance`, { from: "ready" });
    expect(code(await react(a, "hello"))).toBe("BAD_REQUEST");
    expect((await react(b, "🔥")).status).toBe(200);
    // A burst at once lands in one window (the counter works in clock windows).
    const burst = await Promise.all(Array.from({ length: 35 }, () => react(a, "😂")));
    const limited = burst.some((r) => code(r) === "RATE_LIMITED");
    expect(limited).toBe(true);
  });

  it("Daily Spill: one answer a day each, the share only once 10 answered", async () => {
    const first = await anonPlayer();
    const today = await first.call("GET", "/daily");
    expect(today.status).toBe(200);
    expect(today.body.question.text.length).toBeGreaterThan(0);
    expect(today.body.mine).toBeNull();
    expect(today.body.share).toBeNull();
    const saved = await first.call("POST", "/daily", { value: "yes" });
    expect(saved.body.mine).toBe("yes");
    // A second answer on the same day keeps the first.
    expect((await first.call("POST", "/daily", { value: "no" })).body.mine).toBe("yes");
    expect(code(await first.call("POST", "/daily", { value: "skip" }))).toBe("BAD_REQUEST");
    const others = await Promise.all(Array.from({ length: 10 }, () => anonPlayer()));
    for (const p of others) await p.call("POST", "/daily", { value: "no" });
    const after = await first.call("GET", "/daily");
    expect(after.body.total).toBeGreaterThanOrEqual(11);
    expect(after.body.share).not.toBeNull();
    // Nobody else's answer is ever listed.
    expect(JSON.stringify(after.body)).not.toContain("user_id");
  });

  it("Crews: saved after a game, joined by choice, members only, season table", async () => {
    const room = await fullRoom(3);
    const [host, b, c] = room.players as [Player, Player, Player];
    await host.call("POST", `/rooms/${room.roomCode}/start`);
    await answerAll(host, room.roomCode, () => "yes");
    await answerAll(b, room.roomCode, () => "no");
    await answerAll(c, room.roomCode, (i) => (i < 2 ? "yes" : "no"));
    for (const p of [host, b, c]) await guessAll(p, room.roomCode, 40);
    await host.call("POST", `/rooms/${room.roomCode}/advance`, { from: "ready" });

    expect(
      code(await b.call("POST", "/crews", { roomCode: room.roomCode, name: "Not mine" })),
    ).toBe("NOT_HOST");
    expect(
      code(await host.call("POST", "/crews", { roomCode: room.roomCode, name: "f4g crew" })),
    ).toBe("TEXT_BLOCKED");
    const crew = await host.call("POST", "/crews", { roomCode: room.roomCode, name: "Lagos Fam" });
    expect(crew.status).toBe(200);
    const crewId: string = crew.body.id;

    // Only the host joined; the others are offered it.
    const bState = await b.call("GET", `/rooms/${room.roomCode}/state`);
    expect(bState.body.room.crew).toMatchObject({ id: crewId, name: "Lagos Fam", member: false });
    expect(code(await b.call("GET", `/crews/${crewId}`))).toBe("NOT_FOUND");
    expect((await b.call("POST", "/crews/join", { roomCode: room.roomCode })).status).toBe(200);
    const seen = await b.call("GET", `/crews/${crewId}`);
    expect(seen.body.members).toHaveLength(2);
    // The round just played counts for members only.
    expect(seen.body.table).toHaveLength(2);
    expect(seen.body.rounds).toHaveLength(1);
    expect(JSON.stringify(seen.body)).not.toMatch(/spill_?score|answers/i);

    const invite = await anonPlayer();
    expect((await invite.call("GET", `/crews/invite/${crew.body.token}`)).body).toEqual({
      name: "Lagos Fam",
      members: 2,
    });
    expect(
      (await invite.call("POST", "/crews/join", { token: crew.body.token, nickname: "Esi" }))
        .status,
    ).toBe(200);
    expect((await invite.call("GET", "/crews")).body).toEqual([
      { id: crewId, name: "Lagos Fam", members: 3 },
    ]);
    await invite.call("POST", `/crews/${crewId}/leave`);
    expect((await invite.call("GET", "/crews")).body).toEqual([]);

    // A member can start a room as the crew; someone else cannot.
    const asCrew = await b.call("POST", "/rooms", {
      ageBand: "18_plus",
      packId: "classic",
      crewId,
    });
    expect(asCrew.status).toBe(200);
    expect(
      code(await invite.call("POST", "/rooms", { ageBand: "18_plus", packId: "classic", crewId })),
    ).toBe("NOT_FOUND");
  });

  it("Custom packs: host only, 18+ rooms only, filtered, private to the room, kept on rematch", async () => {
    const room = await fullRoom(2);
    const [host, guest] = room.players as [Player, Player];
    const add = (p: Player, text: string) =>
      p.call("POST", `/rooms/${room.roomCode}/custom`, { text });
    expect(code(await add(guest, "eaten a whole cake alone"))).toBe("NOT_HOST");
    expect(code(await add(host, "called someone a f4g"))).toBe("TEXT_BLOCKED");
    const first = await add(host, "Have you ever eaten a whole cake alone?");
    expect(first.body).toEqual([{ id: expect.any(String), text: "eaten a whole cake alone?" }]);
    expect(code(await host.call("POST", `/rooms/${room.roomCode}/custom/use`))).toBe("BAD_REQUEST");
    for (const t of [
      "sung in the shower",
      "missed a flight",
      "laughed at a funeral",
      "texted the wrong person",
    ])
      await add(host, t);
    const used = await host.call("POST", `/rooms/${room.roomCode}/custom/use`);
    expect(used.status).toBe(200);
    expect(used.body.room.pack.minAge).toBe(18);
    // Never listed for anyone else.
    const listed = await guest.call("GET", "/packs?band=18_plus");
    expect(listed.body.some((p: { id: string }) => p.id === used.body.room.pack.id)).toBe(false);
    await host.call("POST", `/rooms/${room.roomCode}/start`);
    const playing = await guest.call("GET", `/rooms/${room.roomCode}/state`);
    const texts = playing.body.questions.map((q: { text: string }) => q.text);
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.every((t: string) => t.endsWith("?"))).toBe(true);

    // A room with a 16 to 17 player cannot write its own.
    const mixed = await anonPlayer();
    const created = await mixed.call("POST", "/rooms", { ageBand: "18_plus", packId: "classic" });
    await mixed.call("POST", `/rooms/${created.body.code}/join`, {
      ageBand: "18_plus",
      nickname: "Host",
      avatar: 1,
    });
    const teen = await anonPlayer();
    await teen.call("POST", `/rooms/${created.body.code}/join`, {
      ageBand: "16_17",
      nickname: "Teen",
      avatar: 2,
    });
    const mixedState = await mixed.call("GET", `/rooms/${created.body.code}/state`);
    expect(mixedState.body.room.customAllowed).toBe(false);
    expect(
      code(
        await mixed.call("POST", `/rooms/${created.body.code}/custom`, {
          text: "sung in the shower",
        }),
      ),
    ).toBe("CUSTOM_ADULTS_ONLY");
  });

  it("Local packs: SHS Days, Exam Season and Church Kid for 13+, Detty December for 16+", async () => {
    const p = await anonPlayer();
    const ids = async (band: string) =>
      ((await p.call("GET", `/packs?band=${band}`)).body as Array<{ id: string }>).map((x) => x.id);
    const young = await ids("13_15");
    for (const id of ["shs_days", "exam_season", "church_kid"]) expect(young).toContain(id);
    expect(young).not.toContain("detty_december");
    expect(await ids("16_17")).toContain("detty_december");
    const preview = await p.call("GET", "/packs/shs_days/preview?band=13_15");
    expect(preview.body.questions).toHaveLength(3);
  });

  it("two players are enough to start", async () => {
    const room = await fullRoom(2);
    expect((await room.host.call("POST", `/rooms/${room.roomCode}/start`)).status).toBe(200);
  });

  it("an adult room starts when everyone is 18 or older", async () => {
    const room = await fullRoom(3);
    await room.host.call("PATCH", `/rooms/${room.roomCode}/pack`, { packId: "afterdark" });
    const started = await room.host.call("POST", `/rooms/${room.roomCode}/start`);
    expect(started.body.room.status).toBe("answering");
  });

  it("SPIL-02: under 13 cannot create or join", async () => {
    const kid = await anonPlayer();
    expect(code(await kid.call("POST", "/rooms", { ageBand: "under_13", packId: "classic" }))).toBe(
      "AGE_TOO_YOUNG",
    );
    const room = await fullRoom(1);
    const res = await kid.call("POST", `/rooms/${room.roomCode}/join`, {
      ageBand: "under_13",
      nickname: "Kid",
      avatar: 0,
    });
    expect(code(res)).toBe("AGE_TOO_YOUNG");
  });

  it("SPIL-02: a 13 to 15 host cannot create an 18+ room", async () => {
    const teen = await anonPlayer();
    const res = await teen.call("POST", "/rooms", { ageBand: "13_15", packId: "afterdark" });
    expect(res.status).toBe(409);
    expect(code(res)).toBe("PACK_NOT_ALLOWED");
  });

  it("SPIL-02: a 16 to 17 guest cannot join an 18+ room, and no player is created", async () => {
    const host = await anonPlayer();
    const created = await host.call("POST", "/rooms", { ageBand: "18_plus", packId: "afterdark" });
    const roomCode = created.body.code;
    await host.call("POST", `/rooms/${roomCode}/join`, {
      ageBand: "18_plus",
      nickname: "Host",
      avatar: 0,
    });
    const guest = await anonPlayer();
    const res = await guest.call("POST", `/rooms/${roomCode}/join`, {
      ageBand: "16_17",
      nickname: "Kwame",
      avatar: 1,
    });
    expect(res.status).toBe(403);
    expect(code(res)).toBe("AGE_RESTRICTED");
    const preview = await guest.call("GET", `/rooms/${roomCode}`);
    expect(preview.body).toMatchObject({ playerCount: 1, joined: false, minAge: 18 });
  });

  it("SPIL-02: with a minor in the lobby the host cannot pick or force an 18+ pack", async () => {
    const host = await anonPlayer();
    const created = await host.call("POST", "/rooms", { ageBand: "18_plus", packId: "classic" });
    const roomCode = created.body.code;
    await host.call("POST", `/rooms/${roomCode}/join`, {
      ageBand: "18_plus",
      nickname: "Host",
      avatar: 0,
    });
    const teen = await anonPlayer();
    await teen.call("POST", `/rooms/${roomCode}/join`, {
      ageBand: "13_15",
      nickname: "Esi",
      avatar: 1,
    });

    const offered = await host.call("GET", `/rooms/${roomCode}/packs`);
    expect(offered.body.someHidden).toBe(true);
    expect(offered.body.packs.every((p: { minAge: number }) => p.minAge <= 13)).toBe(true);

    const forced = await host.call("PATCH", `/rooms/${roomCode}/pack`, { packId: "afterdark" });
    expect(forced.status).toBe(409);
    expect(code(forced)).toBe("PACK_NOT_ALLOWED");
    expect(code(await teen.call("GET", `/rooms/${roomCode}/packs`))).toBe("NOT_HOST");
  });

  it("SPIL-02: the pack list depends on the band and never leaks adult packs", async () => {
    const p = await anonPlayer();
    const teen = await p.call("GET", "/packs?band=13_15");
    expect(teen.body.length).toBeGreaterThan(0);
    expect(teen.body.every((x: { minAge: number }) => x.minAge === 13)).toBe(true);
    const none = await p.call("GET", "/packs");
    expect(none.body.every((x: { minAge: number }) => x.minAge === 13)).toBe(true);
    const adult = await p.call("GET", "/packs?band=18_plus");
    expect(adult.body.some((x: { minAge: number }) => x.minAge === 18)).toBe(true);
  });

  it("SPIL-02: state never carries an age band", async () => {
    const room = await fullRoom(2);
    const state = await room.host.call("GET", `/rooms/${room.roomCode}/state`);
    expect(JSON.stringify(state.body)).not.toMatch(/age_?band|ageConfirmed/i);
  });

  it("test players fill the room and play themselves", async () => {
    const host = await anonPlayer();
    const created = await host.call("POST", "/rooms", {
      ageBand: "18_plus",
      packId: "classic",
      questionCount: 5,
    });
    const roomCode = created.body.code;
    await host.call("POST", `/rooms/${roomCode}/join`, {
      ageBand: "18_plus",
      nickname: "Host",
      avatar: 0,
    });
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
