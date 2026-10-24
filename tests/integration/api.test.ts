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
      mode: "red_green",
    });
    expect(code(notBuilt)).toBe("MODE_UNAVAILABLE");

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
