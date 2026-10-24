import "server-only";
import {
  computeResults,
  guessTargets,
  isScoredPlayer as isScoredPhase,
  planAdvance,
  isRoomExpired,
  nextHost,
  type AnswerValue,
  type AwardId,
  type LabelId,
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
  p: Pick<PackRow, "id" | "name" | "icon" | "is_adult" | "heat">,
): PackSummary {
  return { id: p.id, name: p.name, icon: p.icon, isAdult: p.is_adult, heat: p.heat };
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
  ageConfirmed: p.age_confirmed,
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

/** Builds the results input from this round's rows. */
async function resultsInput(room: RoomRow, players: PlayerRow[]) {
  const [questions, answers, guesses] = await Promise.all([
    currentQuestions(room),
    roundAnswers(room),
    roundGuesses(room),
  ]);
  const byPlayer = (id: string) =>
    Object.fromEntries(
      answers.filter((a) => a.player_id === id).map((a) => [a.question_id, a.value as AnswerValue]),
    );
  const guessesBy = (id: string) =>
    Object.fromEntries(
      guesses.filter((g) => g.guesser_id === id).map((g) => [g.target_id, g.value]),
    );
  const input: { questions: typeof questions; players: ResultsPlayer[] } = {
    questions,
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
  const results = computeResults(await resultsInput(room, players));
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
  const plan = planAdvance(room.status, players.map(toPhase));
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

  if (room.status === "guessing") {
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
  const countFor = (id: string) => answers.filter((a) => a.player_id === id).length;

  const visible = players.filter(inGame);
  const statePlayers: StatePlayer[] = visible.map((p) => ({
    id: p.id,
    nickname: p.nickname,
    avatar: p.avatar,
    rotationSeed: p.rotation_seed,
    isHost: p.id === room.host_player_id,
    isBot: p.is_bot,
    ageConfirmed: p.age_confirmed || p.is_bot,
    status: p.status as PlayerStatus,
    answered: countFor(p.id),
    answersSubmitted: p.answers_submitted_at != null,
    guessesSubmitted: p.guesses_submitted_at != null,
  }));

  const state: RoomState = {
    room: {
      code: room.code,
      status: room.status,
      round: room.round,
      pack: packSummary(pack),
      questionCount: room.question_count ?? settings.questionsPerGame,
      revealedAt: room.revealed_at ?? undefined,
      guessingAt: room.guessing_at ?? undefined,
      settings: { minPlayers: settings.minPlayers, maxPlayers: settings.maxPlayers },
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
      ageConfirmed: me.age_confirmed,
      answersSubmitted: me.answers_submitted_at != null,
      guessesSubmitted: me.guesses_submitted_at != null,
      spillMode: me.spill_mode,
      hideNameOnCard: me.hide_name_on_card,
      targets:
        room.status === "guessing"
          ? guessTargets(players.map(toPhase), me.id).map((p) => p.id)
          : [],
    },
    players: statePlayers,
  };

  if (room.status === "answering") {
    state.questions = questions;
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
    const { questionStats } = computeResults(input);
    state.results = {
      rows: (rows ?? []).map((r) => ({
        playerId: r.player_id,
        nickname: byId.get(r.player_id)?.nickname ?? "",
        avatar: byId.get(r.player_id)?.avatar ?? 0,
        score: r.spill_score,
        label: r.label as LabelId,
        avgGuessAbout: r.avg_guess_about,
        mindReader: r.mind_reader,
        rank: r.rank,
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

/** Reloads everything after a write and returns the caller's fresh state. */
export async function freshState(code: string, userId: string) {
  return buildState(await requireMember(code, userId));
}

/** Players who have a score this round: active, or sat out only the guessing phase. */
export function isScoredPlayer(p: PlayerRow) {
  return isScoredPhase(toPhase(p));
}
