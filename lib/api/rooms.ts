import "server-only";
import {
  computeResults,
  guessesQuestions,
  hotTakesResults,
  mostLikelyResults,
  ratesStatements,
  votesForPlayers,
  flagResults,
  skipsGuessing,
  swipesFlags,
  isMode,
  modeMinPlayers,
  roomPercentResults,
  type Mode,
  type HotTakesResults,
  type PercentQuestion,
  type PercentResults,
  guessTargets,
  revealSlides,
  spillGroups,
  spillTies,
  CLOSEST_BONUS,
  isScoredPlayer as isScoredPhase,
  planAdvance,
  isRoomExpired,
  MIN_ANSWERS_FOR_STATS,
  youngestFloor,
  nextHost,
  type AnswerValue,
  type AwardId,
  type LabelId,
  type MinAge,
  type PlayerStatus,
  type ResultsPlayer,
  type RoomStatus,
} from "@/lib/game";
import { getFlags, getSettings } from "@/lib/flags";
import { getAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { ApiError, fromDbError } from "./errors";
import type { PackSummary, RoomState, StatePlayer } from "./types";

type Tables = Database["public"]["Tables"];
export type RoomRow = Tables["rooms"]["Row"];
export type PlayerRow = Tables["players"]["Row"];
type PackRow = Tables["packs"]["Row"];

const db = () => getAdminClient();

export function packSummary(
  p: Pick<PackRow, "id" | "name" | "icon" | "min_age" | "heat">,
): PackSummary {
  return {
    id: p.id,
    name: p.name,
    icon: p.icon,
    isAdult: p.min_age >= 18,
    heat: p.heat,
    minAge: p.min_age as MinAge,
  };
}

/** The youngest active player's band floor: what the lobby pack picker may offer (SPIL-02). */
export function roomFloor(players: readonly PlayerRow[]): MinAge {
  return youngestFloor(players.filter((p) => p.status === "active").map((p) => p.age_band));
}

/** The live room with this code, or the most recent closed one (so we can say "expired"). */
export async function findRoom(code: string): Promise<RoomRow | null> {
  const { data, error } = await db()
    .from("rooms")
    .select("*")
    .eq("code", code)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw fromDbError(error);
  return data;
}

export async function requireRoom(code: string): Promise<RoomRow> {
  const room = await findRoom(code);
  if (!room) throw new ApiError("ROOM_NOT_FOUND");
  return room;
}

export async function loadPlayers(roomId: string): Promise<PlayerRow[]> {
  const { data, error } = await db()
    .from("players")
    .select("*")
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true });
  if (error) throw fromDbError(error);
  return data ?? [];
}

export async function loadPack(id: string): Promise<PackRow> {
  const { data, error } = await db().from("packs").select("*").eq("id", id).maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new ApiError("PACK_UNAVAILABLE");
  return data;
}

export type Ctx = { room: RoomRow; players: PlayerRow[]; me: PlayerRow; pack: PackRow };

const inGame = (p: PlayerRow) => p.status === "active" || p.status === "sat_out";

/** Room, its players and its pack in one round trip. */
async function loadRoomFull(code: string) {
  const { data, error } = await db()
    .from("rooms")
    .select("*, players!players_room_id_fkey(*), packs(*)")
    .eq("code", code)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new ApiError("ROOM_NOT_FOUND");
  const { players, packs, ...room } = data;
  if (!packs) throw new ApiError("PACK_UNAVAILABLE");
  const sorted = [...players].sort((a, b) => a.joined_at.localeCompare(b.joined_at));
  return { room: room as RoomRow, players: sorted, pack: packs as PackRow };
}

/**
 * Loads the room and the caller's player. Removed players get NOT_IN_ROOM with a REMOVED hint so
 * the client can show "The host removed you".
 */
export async function requireMember(code: string, userId: string): Promise<Ctx> {
  const { room, players, pack } = await loadRoomFull(code);
  const me = players.find((p) => p.user_id === userId);
  if (!me) throw new ApiError("NOT_IN_ROOM");
  if (me.status === "removed") throw new ApiError("NOT_IN_ROOM", "REMOVED");
  if (me.status === "left") throw new ApiError("NOT_IN_ROOM");
  if (room.status === "closed") throw new ApiError("ROOM_EXPIRED");
  return { room, players, me, pack };
}

export function requireHost(ctx: Ctx) {
  if (ctx.room.host_player_id !== ctx.me.id) throw new ApiError("NOT_HOST");
}

export function requirePhase(room: RoomRow, ...phases: RoomStatus[]) {
  if (!phases.includes(room.status)) throw new ApiError("WRONG_PHASE");
}

export function checkJoinable(room: RoomRow | null, activeCount: number, maxPlayers: number) {
  if (!room) throw new ApiError("ROOM_NOT_FOUND");
  if (isRoomExpired({ status: room.status, createdAt: room.created_at }, Date.now()))
    throw new ApiError("ROOM_EXPIRED");
  if (room.status !== "lobby") throw new ApiError("GAME_STARTED");
  if (activeCount >= maxPlayers) throw new ApiError("ROOM_FULL");
}

const toPhase = (p: PlayerRow) => ({
  id: p.id,
  status: p.status as PlayerStatus,
  joinedAt: p.joined_at,
  answersSubmittedAt: p.answers_submitted_at,
  guessesSubmittedAt: p.guesses_submitted_at,
  ageBand: p.age_band,
  lastSeenAt: p.last_seen_at,
});

/** Heartbeat plus host handover when the host left or went quiet for 10 minutes. */
export async function heartbeat(ctx: Ctx) {
  const now = new Date().toISOString();
  await db().from("players").update({ last_seen_at: now }).eq("id", ctx.me.id);
  ctx.me.last_seen_at = now;
  const humans = ctx.players.filter((p) => !p.is_bot);
  const creator = humans.find((p) => p.user_id === ctx.room.created_by);
  const host = nextHost(humans.map(toPhase), ctx.room.host_player_id, now, creator?.id);
  if (host && host !== ctx.room.host_player_id) {
    await db().from("rooms").update({ host_player_id: host }).eq("id", ctx.room.id);
    ctx.room.host_player_id = host;
  }
}

async function currentQuestions(room: RoomRow) {
  const { data, error } = await db()
    .from("room_questions")
    .select("position, question_id, questions(text)")
    .eq("room_id", room.id)
    .eq("round", room.round)
    .order("position");
  if (error) throw fromDbError(error);
  return (data ?? []).map((r) => ({
    id: r.question_id,
    text: (r.questions as { text: string } | null)?.text ?? "",
  }));
}

async function roundAnswers(room: RoomRow) {
  const { data, error } = await db()
    .from("answers")
    .select("player_id, question_id, value")
    .eq("room_id", room.id)
    .eq("round", room.round);
  if (error) throw fromDbError(error);
  return data ?? [];
}

async function roundGuesses(room: RoomRow) {
  const { data, error } = await db()
    .from("guesses")
    .select("guesser_id, target_id, value")
    .eq("room_id", room.id)
    .eq("round", room.round);
  if (error) throw fromDbError(error);
  return data ?? [];
}

async function roundInputs(room: RoomRow, kind: "percent" | "rating" | "vote") {
  const { data, error } = await db()
    .from("mode_inputs")
    .select("player_id, question_id, target_id, value")
    .eq("room_id", room.id)
    .eq("round", room.round)
    .eq("kind", kind);
  if (error) throw fromDbError(error);
  return data ?? [];
}

export const roomMode = (room: RoomRow): Mode => (isMode(room.mode) ? room.mode : "classic");

/**
 * Read the room modes: the questions a player can guess the room's number for, the ones 3 or
 * more scored players answered (Room Percentage: yes or no; Hot Takes: rated), so the number
 * never gives anyone's answer away.
 */
export async function percentTargets(room: RoomRow, players: PlayerRow[]) {
  const scored = new Set(players.filter(isScoredPlayer).map((p) => p.id));
  if (ratesStatements(roomMode(room))) {
    const [questions, ratings] = await Promise.all([
      currentQuestions(room),
      roundInputs(room, "rating"),
    ]);
    return questions.filter(
      (q) =>
        ratings.filter((r) => r.question_id === q.id && scored.has(r.player_id)).length >=
        MIN_ANSWERS_FOR_STATS,
    );
  }
  const [questions, answers] = await Promise.all([currentQuestions(room), roundAnswers(room)]);
  return questions.filter(
    (q) =>
      answers.filter((a) => a.question_id === q.id && scored.has(a.player_id) && a.value !== "skip")
        .length >= MIN_ANSWERS_FOR_STATS,
  );
}

/** Hot Takes: a player's ratings this round, by question id. */
export async function myRatings(room: RoomRow, playerId: string) {
  const ratings = await roundInputs(room, "rating");
  return Object.fromEntries(
    ratings
      .filter((r) => r.player_id === playerId && r.question_id && r.value != null)
      .map((r) => [r.question_id!, r.value!]),
  );
}

/** Most Likely To: a player's votes this round, question id to the player they picked. */
export async function myVotes(room: RoomRow, playerId: string) {
  const votes = await roundInputs(room, "vote");
  return Object.fromEntries(
    votes
      .filter((v) => v.player_id === playerId && v.question_id && v.target_id)
      .map((v) => [v.question_id!, v.target_id!]),
  );
}

/** Results of a read the room mode (Room Percentage or Hot Takes); null in classic. */
function readResults(
  room: RoomRow,
  input: Awaited<ReturnType<typeof resultsInput>>,
): (PercentResults & Partial<Pick<HotTakesResults, "hottest">>) | null {
  const mode = roomMode(room);
  if (ratesStatements(mode)) return hotTakesResults(input);
  return guessesQuestions(mode) ? roomPercentResults(input) : null;
}

/** Builds the results input from this round's rows. */
async function resultsInput(room: RoomRow, players: PlayerRow[]) {
  const [questions, answers, guesses, percents, rated, cast] = await Promise.all([
    currentQuestions(room),
    roundAnswers(room),
    roundGuesses(room),
    guessesQuestions(roomMode(room)) ? roundInputs(room, "percent") : Promise.resolve([]),
    ratesStatements(roomMode(room)) ? roundInputs(room, "rating") : Promise.resolve([]),
    votesForPlayers(roomMode(room)) ? roundInputs(room, "vote") : Promise.resolve([]),
  ]);
  const byPlayer = (id: string) =>
    Object.fromEntries(
      answers.filter((a) => a.player_id === id).map((a) => [a.question_id, a.value as AnswerValue]),
    );
  const guessesBy = (id: string) =>
    Object.fromEntries(
      guesses.filter((g) => g.guesser_id === id).map((g) => [g.target_id, g.value]),
    );
  const percentGuesses: Record<string, Record<string, number>> = {};
  for (const p of percents)
    if (p.question_id && p.value != null)
      (percentGuesses[p.player_id] ??= {})[p.question_id] = p.value;
  const ratings: Record<string, Record<string, number>> = {};
  for (const r of rated)
    if (r.question_id && r.value != null) (ratings[r.player_id] ??= {})[r.question_id] = r.value;
  const votes: Record<string, Record<string, string>> = {};
  for (const v of cast)
    if (v.question_id && v.target_id) (votes[v.player_id] ??= {})[v.question_id] = v.target_id;
  const input: {
    questions: typeof questions;
    players: ResultsPlayer[];
    percentGuesses: typeof percentGuesses;
    ratings: typeof ratings;
    votes: typeof votes;
  } = {
    questions,
    percentGuesses,
    ratings,
    votes,
    players: players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      status: p.status as PlayerStatus,
      joinedAt: p.joined_at,
      answersSubmittedAt: p.answers_submitted_at,
      guessesSubmittedAt: p.guesses_submitted_at,
      spillMode: p.spill_mode,
      answers: byPlayer(p.id),
      guesses: guessesBy(p.id),
    })),
  };
  return input;
}

/** ready -> revealed: compute with lib/game and persist via the idempotent save_results. */
export async function finalize(room: RoomRow, players: PlayerRow[]) {
  const input = await resultsInput(room, players);
  const percent = readResults(room, input);
  const results =
    percent ??
    (votesForPlayers(roomMode(room))
      ? mostLikelyResults(input)
      : swipesFlags(roomMode(room))
        ? flagResults(input)
        : computeResults(input));
  if (percent) {
    // Keep each guess's points on its input, so this round never changes later.
    const updates = percent.percentQuestions.flatMap((q) =>
      q.guesses.map((g) =>
        db()
          .from("mode_inputs")
          .update({ points: g.points, closest: g.closest })
          .eq("player_id", g.playerId)
          .eq("round", room.round)
          .eq("kind", "percent")
          .eq("question_id", q.questionId),
      ),
    );
    const done = await Promise.all(updates);
    const failed = done.find((r) => r.error);
    if (failed?.error) throw fromDbError(failed.error);
  }
  // SPIL-09: keep each guess's points on its row, so this round never changes later.
  const valueOf = new Map(input.players.map((p) => [p.id, p.guesses]));
  if (results.guessPoints.length) {
    const { error: pointsError } = await db()
      .from("guesses")
      .upsert(
        results.guessPoints.map((g) => ({
          guesser_id: g.guesserId,
          target_id: g.targetId,
          room_id: room.id,
          round: room.round,
          value: valueOf.get(g.guesserId)?.[g.targetId] ?? 0,
          points: g.points,
          closest: g.closest,
        })),
      );
    if (pointsError) throw fromDbError(pointsError);
  }
  const { error } = await db().rpc("save_results", {
    p_room: room.id,
    p_round: room.round,
    p_results: results.rows.map((r) => ({
      player_id: r.playerId,
      spill_score: r.score,
      label: r.label,
      avg_guess_about: r.avgGuessAbout,
      mind_reader: r.mindReader,
      rank: r.rank,
    })),
    p_awards: results.awards.map((a) => ({
      award: a.award,
      player_id: a.playerId,
      reason: a.reason,
      position: a.position,
    })),
  });
  if (error) throw fromDbError(error);
}

/**
 * The one place a room moves on by itself (SPIL-01). Locks players who have nobody to guess
 * about, then advances answering -> guessing -> ready when everyone it waits for is done.
 * Idempotent and safe to call concurrently: locks only set empty timestamps, and advance_room
 * takes a row lock and refuses a phase the room has already left. Called after every write that
 * can change readiness and whenever a client loads the room. Returns the room as it now stands:
 * the same object when nothing changed, a new one when it locked anyone or moved on.
 */
export async function advancePhaseIfReady(room: RoomRow, players: PlayerRow[]): Promise<RoomRow> {
  const questionTargets =
    room.status === "guessing" && guessesQuestions(roomMode(room))
      ? (await percentTargets(room, players)).length
      : // Most Likely To and Red Flag, Green Flag have nothing to guess: everyone locks and the
        // room goes to Lights down.
        room.status === "guessing" && skipsGuessing(roomMode(room))
        ? 0
        : undefined;
  const plan = planAdvance(room.status, players.map(toPhase), { questionTargets });
  if (plan.lock.length) {
    const { error } = await db()
      .from("players")
      .update({ guesses_submitted_at: new Date().toISOString() })
      .in("id", plan.lock)
      .is("guesses_submitted_at", null);
    if (error) throw fromDbError(error);
  }
  if (!plan.to) return plan.lock.length ? { ...room } : room;
  const { data, error } = await db().rpc("advance_room", {
    p_room: room.id,
    p_from: room.status,
    p_to: plan.to,
  });
  // Another request may have advanced it first; that is fine.
  if (error && error.message !== "WRONG_PHASE") throw fromDbError(error);
  const next = (data as RoomRow | null) ?? room;
  // A fresh guessing phase may already be decided (nobody has anyone to guess about).
  if (next.status === "guessing" && next.status !== room.status)
    return advancePhaseIfReady(next, await loadPlayers(room.id));
  return next;
}

const FORCE_NEXT = { answering: "guessing", guessing: "ready" } as const;

/**
 * Moves a live room on one phase without waiting: the host's "Move on without them" and the
 * admin's Force advance. Answering and guessing mark unfinished players sat_out first; ready
 * computes and saves results (idempotent). Returns false when the room is not in a phase that
 * can be forced.
 */
export async function forceAdvance(room: RoomRow): Promise<boolean> {
  if (room.status === "ready") {
    // SPIL-11: the reveal starts on its first slide, now.
    await db()
      .from("rooms")
      .update({ reveal_index: 0, reveal_at: new Date().toISOString() })
      .eq("id", room.id);
    await finalize(room, await loadPlayers(room.id));
    return true;
  }
  if (room.status !== "answering" && room.status !== "guessing") return false;
  const column = room.status === "answering" ? "answers_submitted_at" : "guesses_submitted_at";
  await db()
    .from("players")
    .update({ status: "sat_out" })
    .eq("room_id", room.id)
    .eq("status", "active")
    .is(column, null);
  const { data, error } = await db().rpc("advance_room", {
    p_room: room.id,
    p_from: room.status,
    p_to: FORCE_NEXT[room.status],
  });
  if (error && error.message !== "WRONG_PHASE") throw fromDbError(error);
  if (data && (data as RoomRow).status === "guessing") {
    const next = await advancePhaseIfReady(data as RoomRow, await loadPlayers(room.id));
    if (next.status === "guessing") await autoplayBots(next);
  }
  return true;
}

/**
 * Test players (dev and staging only): answer and guess instantly when a phase opens, with a
 * random lean so scores spread out. Then the room may advance.
 */
export async function autoplayBots(room: RoomRow) {
  const players = await loadPlayers(room.id);
  const bots = players.filter((p) => p.is_bot && p.status === "active");
  if (!bots.length) return;
  const now = new Date().toISOString();

  if (room.status === "answering") {
    const questions = await currentQuestions(room);
    const pending = bots.filter((b) => !b.answers_submitted_at);
    await Promise.all(
      pending.map(async (bot) => {
        const lean = 0.15 + (bot.rotation_seed % 70) / 100;
        if (votesForPlayers(roomMode(room))) {
          const others = players.filter((p) => p.id !== bot.id && isScoredPlayer(p));
          if (others.length)
            await db().rpc("save_mode_inputs", {
              p_player: bot.id,
              p_room: room.id,
              p_round: room.round,
              p_kind: "vote",
              p_inputs: questions.map((q) => ({
                question_id: q.id,
                target_id: others[Math.floor(Math.random() * others.length)]!.id,
              })),
            });
          await db().from("players").update({ answers_submitted_at: now }).eq("id", bot.id);
          return;
        }
        if (ratesStatements(roomMode(room))) {
          await db().rpc("save_mode_inputs", {
            p_player: bot.id,
            p_room: room.id,
            p_round: room.round,
            p_kind: "rating",
            p_inputs: questions.map((q) => ({
              question_id: q.id,
              value: Math.round(
                Math.min(100, Math.max(0, lean * 100 + (Math.random() - 0.5) * 60)),
              ),
            })),
          });
          await db().from("players").update({ answers_submitted_at: now }).eq("id", bot.id);
          return;
        }
        const rows = questions.map((q) => ({
          player_id: bot.id,
          room_id: room.id,
          round: room.round,
          question_id: q.id,
          value: (Math.random() < lean ? "yes" : "no") as AnswerValue,
        }));
        if (rows.length) await db().from("answers").upsert(rows);
        await db().from("players").update({ answers_submitted_at: now }).eq("id", bot.id);
      }),
    );
  }

  if (room.status === "guessing" && guessesQuestions(roomMode(room))) {
    const questions = await percentTargets(room, players);
    await Promise.all(
      bots
        .filter((b) => !b.guesses_submitted_at)
        .map(async (bot) => {
          if (questions.length)
            await db().rpc("save_mode_inputs", {
              p_player: bot.id,
              p_room: room.id,
              p_round: room.round,
              p_kind: "percent",
              p_inputs: questions.map((q) => ({
                question_id: q.id,
                value: Math.round(Math.random() * 100),
              })),
            });
          await db().from("players").update({ guesses_submitted_at: now }).eq("id", bot.id);
        }),
    );
  } else if (room.status === "guessing" && !skipsGuessing(roomMode(room))) {
    const targets = players.filter((p) => p.status === "active" || p.status === "sat_out");
    await Promise.all(
      bots
        .filter((b) => !b.guesses_submitted_at)
        .map(async (bot) => {
          const rows = targets
            .filter((t) => t.id !== bot.id)
            .map((t) => ({
              guesser_id: bot.id,
              target_id: t.id,
              room_id: room.id,
              round: room.round,
              value: Math.round(Math.random() * 100),
            }));
          if (rows.length) await db().from("guesses").upsert(rows);
          await db().from("players").update({ guesses_submitted_at: now }).eq("id", bot.id);
        }),
    );
  }

  const advanced = await advancePhaseIfReady(room, await loadPlayers(room.id));
  if (advanced.status !== room.status && advanced.status === "guessing")
    await autoplayBots(advanced);
}

const BOT_NAMES = [
  "Sam",
  "Riley",
  "Jordan",
  "Alex",
  "Kemi",
  "Noor",
  "Leo",
  "Maya",
  "Theo",
  "Zara",
  "Ivy",
  "Remi",
];
export function botName(taken: string[]) {
  const lower = new Set(taken.map((t) => t.toLowerCase()));
  return BOT_NAMES.find((n) => !lower.has(n.toLowerCase())) ?? `Guest ${taken.length + 1}`;
}

/** The full client view of the room for one player. */
export async function buildState(ctx: Ctx): Promise<RoomState> {
  const { room, me, pack } = ctx;
  const players = ctx.players;
  const needAnswers = room.status === "answering" || room.status === "guessing";
  const [settings, flags, answers, questions, guesses] = await Promise.all([
    getSettings(),
    getFlags(),
    needAnswers ? roundAnswers(room) : Promise.resolve([]),
    room.status === "answering" ? currentQuestions(room) : Promise.resolve([]),
    room.status === "guessing" || room.status === "ready"
      ? roundGuesses(room)
      : Promise.resolve([]),
  ]);
  // Hot Takes counts ratings and Most Likely To votes, not yes or no answers (SPIL-03).
  const rated =
    room.status === "answering" && ratesStatements(roomMode(room))
      ? await roundInputs(room, "rating")
      : room.status === "answering" && votesForPlayers(roomMode(room))
        ? await roundInputs(room, "vote")
        : null;
  const countFor = (id: string) => (rated ?? answers).filter((a) => a.player_id === id).length;

  const visible = players.filter(inGame);
  const statePlayers: StatePlayer[] = visible.map((p) => ({
    id: p.id,
    nickname: p.nickname,
    avatar: p.avatar,
    rotationSeed: p.rotation_seed,
    isHost: p.id === room.host_player_id,
    isBot: p.is_bot,
    status: p.status as PlayerStatus,
    answered: countFor(p.id),
    // Only this round's: a time from before the round started belongs to the last one.
    lastAnswerAt:
      room.status === "answering" &&
      p.last_answer_at &&
      room.started_at &&
      Date.parse(p.last_answer_at) >= Date.parse(room.started_at)
        ? p.last_answer_at
        : undefined,
    answersSubmitted: p.answers_submitted_at != null,
    guessesSubmitted: p.guesses_submitted_at != null,
  }));

  const state: RoomState = {
    room: {
      code: room.code,
      status: room.status,
      round: room.round,
      pack: packSummary(pack),
      mode: roomMode(room),
      questionCount: room.question_count ?? settings.questionsPerGame,
      revealedAt: room.revealed_at ?? undefined,
      guessingAt: room.guessing_at ?? undefined,
      settings: {
        minPlayers: modeMinPlayers(roomMode(room), settings.minPlayers),
        maxPlayers: settings.maxPlayers,
      },
      testPlayers: flags.test_players,
      pollingOnly: flags.polling_only,
      channel: `room:${room.id}`,
    },
    me: {
      id: me.id,
      nickname: me.nickname,
      avatar: me.avatar,
      isHost: me.id === room.host_player_id,
      status: me.status as PlayerStatus,
      answersSubmitted: me.answers_submitted_at != null,
      guessesSubmitted: me.guesses_submitted_at != null,
      spillMode: me.spill_mode,
      hideNameOnCard: me.hide_name_on_card,
      // Read the room modes: the question ids this player guesses about; classic: player ids.
      targets:
        room.status === "guessing" && !skipsGuessing(roomMode(room))
          ? guessesQuestions(roomMode(room))
            ? (await percentTargets(room, players)).map((q) => q.id)
            : guessTargets(players.map(toPhase), me.id).map((p) => p.id)
          : [],
    },
    players: statePlayers,
  };

  if (room.status === "answering") {
    state.questions = questions;
    if (ratesStatements(roomMode(room))) state.myRatings = await myRatings(room, me.id);
    if (votesForPlayers(roomMode(room))) state.myVotes = await myVotes(room, me.id);
    state.myAnswers = Object.fromEntries(
      answers
        .filter((a) => a.player_id === me.id)
        .map((a) => [a.question_id, a.value as AnswerValue]),
    );
  }

  if (room.status === "guessing" || room.status === "ready") {
    state.myGuesses = Object.fromEntries(
      guesses.filter((g) => g.guesser_id === me.id).map((g) => [g.target_id, g.value]),
    );
    if (room.status === "guessing" && guessesQuestions(roomMode(room))) {
      const [targets, mine] = await Promise.all([
        percentTargets(room, players),
        roundInputs(room, "percent"),
      ]);
      state.percentQuestions = targets;
      state.myPercent = Object.fromEntries(
        mine
          .filter((i) => i.player_id === me.id && i.question_id && i.value != null)
          .map((i) => [i.question_id!, i.value!]),
      );
    }
  }

  if (room.status === "revealed") {
    const [{ data: rows }, { data: awards }, input] = await Promise.all([
      db()
        .from("results")
        .select("*")
        .eq("room_id", room.id)
        .eq("round", room.round)
        .order("rank")
        .order("spill_score", { ascending: false }),
      db()
        .from("awards")
        .select("*")
        .eq("room_id", room.id)
        .eq("round", room.round)
        .order("position"),
      resultsInput(room, players),
    ]);
    const byId = new Map(players.map((p) => [p.id, p]));
    // Recomputed each time so Spill Mode toggles after the reveal show up live.
    const computed = computeResults(input);
    const { questionStats } = computed;
    const bullseyes = new Map(computed.rows.map((r) => [r.playerId, r.bullseyes]));
    const guessedBy = new Map(computed.rows.map((r) => [r.playerId, r.guessedBy]));
    const ties = spillTies(
      (rows ?? []).map((r) => ({ playerId: r.player_id, score: r.spill_score })),
    );
    const awardRows = awards ?? [];
    const read = readResults(room, input);
    const percent: PercentQuestion[] = read?.percentQuestions ?? [];
    const likely = votesForPlayers(roomMode(room)) ? mostLikelyResults(input) : null;
    const flags = swipesFlags(roomMode(room)) ? flagResults(input) : null;
    state.room.reveal = {
      index: room.reveal_index,
      at: room.reveal_at ?? room.revealed_at ?? new Date().toISOString(),
      total: guessesQuestions(roomMode(room))
        ? revealSlides(percent.length, awardRows.length, "question").length
        : likely || flags
          ? revealSlides(
              likely?.likely.length ?? flags?.flags.length ?? 0,
              awardRows.length,
              "question",
            ).length
          : revealSlides(
              spillGroups((rows ?? []).map((r) => ({ score: r.spill_score }))).length,
              awardRows.length,
            ).length,
    };
    state.results = {
      // Only Room Percentage reveals by question; classic rooms leave it out.
      percent: read ? percent : undefined,
      // Hot Takes: each player's take furthest from the room.
      hottest: read?.hottest,
      // Most Likely To: vote counts per prompt (never who voted for whom) and each player's pick.
      likely: likely?.likely,
      crowned: likely?.crowned,
      // Red Flag, Green Flag: each scenario's split, and each player's most outnumbered swipe.
      flags: flags?.flags,
      lone: flags?.lone,
      exact: computed.guessPoints
        .filter((g) => g.points - (g.closest ? CLOSEST_BONUS : 0) === 10)
        .map((g) => ({ guesserId: g.guesserId, targetId: g.targetId })),
      rows: (rows ?? []).map((r) => ({
        playerId: r.player_id,
        nickname: byId.get(r.player_id)?.nickname ?? "",
        avatar: byId.get(r.player_id)?.avatar ?? 0,
        score: r.spill_score,
        label: r.label as LabelId,
        avgGuessAbout: r.avg_guess_about,
        mindReader: r.mind_reader,
        rank: r.rank,
        ...ties.get(r.player_id),
        bullseyes: bullseyes.get(r.player_id) ?? 0,
        guessedBy: guessedBy.get(r.player_id) ?? 0,
      })),
      awards: (awards ?? []).map((a) => ({
        award: a.award as AwardId,
        playerId: a.player_id,
        reason: a.reason,
        position: a.position,
      })),
      questionStats: questionStats.map((q) => ({
        questionId: q.questionId,
        text: q.text,
        yes: q.yes,
        answered: q.answered,
        spillNames: q.spillNames,
      })),
    };
  }

  return state;
}

/**
 * The reveal's slides for a revealed room (SPIL-11): classic has one per tie group, Room
 * Percentage one per scored question; then one per award.
 */
export async function revealPlan(room: RoomRow, players: PlayerRow[]) {
  const [{ data: rows, error }, { count, error: awardsError }] = await Promise.all([
    db().from("results").select("spill_score").eq("room_id", room.id).eq("round", room.round),
    db()
      .from("awards")
      .select("award", { count: "exact", head: true })
      .eq("room_id", room.id)
      .eq("round", room.round),
  ]);
  if (error) throw fromDbError(error);
  if (awardsError) throw fromDbError(awardsError);
  const awards = count ?? 0;
  if (guessesQuestions(roomMode(room))) {
    const questions = readResults(room, await resultsInput(room, players))!.percentQuestions.length;
    return { groups: questions, slides: revealSlides(questions, awards, "question") };
  }
  if (votesForPlayers(roomMode(room))) {
    const prompts = mostLikelyResults(await resultsInput(room, players)).likely.length;
    return { groups: prompts, slides: revealSlides(prompts, awards, "question") };
  }
  if (swipesFlags(roomMode(room))) {
    const scenarios = flagResults(await resultsInput(room, players)).flags.length;
    return { groups: scenarios, slides: revealSlides(scenarios, awards, "question") };
  }
  const groups = spillGroups((rows ?? []).map((r) => ({ score: r.spill_score }))).length;
  return { groups, slides: revealSlides(groups, awards) };
}

/** Reloads everything after a write and returns the caller's fresh state. */
export async function freshState(code: string, userId: string) {
  return buildState(await requireMember(code, userId));
}

/** Players who have a score this round: active, or sat out only the guessing phase. */
export function isScoredPlayer(p: PlayerRow) {
  return isScoredPhase(toPhase(p));
}
