import "server-only";
import { isMode, modeFormat } from "@/lib/game";
import { filterText } from "@/lib/moderation/filter";
import { getAdminClient } from "@/lib/supabase/admin";
import { ApiError, fromDbError } from "./errors";
import type { Ctx, RoomRow } from "./rooms";

/**
 * Custom packs (Batch 3): the host of an 18+ room writes their own "Have you ever" questions.
 * They live in a hidden pack owned by the room (never listed, never readable through the public
 * API, deleted with the room) and are played, reported and hidden like any other question.
 */
export const MAX_CUSTOM = 30;
export const MIN_CUSTOM_TO_PLAY = 5;

const db = () => getAdminClient();

export const customPackId = (room: RoomRow) => `custom_${room.id.replace(/-/g, "").slice(0, 20)}`;

/** Custom questions only when everyone in the room is 18+ and the game plays yes or no. */
export function customAllowed(ctx: Pick<Ctx, "room" | "players">) {
  const everyone = ctx.players.filter((p) => p.status === "active" || p.status === "sat_out");
  return (
    modeFormat(isMode(ctx.room.mode) ? ctx.room.mode : "classic") === "yes_no" &&
    everyone.length > 0 &&
    everyone.every((p) => p.age_band === "18_plus")
  );
}

function requireAllowed(ctx: Ctx) {
  if (ctx.room.host_player_id !== ctx.me.id) throw new ApiError("NOT_HOST");
  if (ctx.room.status !== "lobby") throw new ApiError("WRONG_PHASE");
  if (!customAllowed(ctx)) throw new ApiError("CUSTOM_ADULTS_ONLY");
}

export async function listCustom(room: RoomRow) {
  const { data, error } = await db()
    .from("questions")
    .select("id, text, status")
    .eq("pack_id", customPackId(room))
    .order("updated_at");
  if (error) throw fromDbError(error);
  return (data ?? []).filter((q) => q.status === "live").map((q) => ({ id: q.id, text: q.text }));
}

/** "Have you ever" is added by the app, so it is taken off the front if typed. */
export function cleanQuestion(input: string) {
  const result = filterText(input.replace(/^\s*have you ever\s*/i, ""));
  if (!result.ok)
    throw new ApiError(
      result.reason === "blocked"
        ? "TEXT_BLOCKED"
        : result.reason === "contact"
          ? "TEXT_CONTACT"
          : "TEXT_EMPTY",
    );
  const text = result.text.replace(/\?+$/, "").trim();
  if (text.length < 8 || text.length > 120)
    throw new ApiError("BAD_REQUEST", "Questions are 8 to 120 characters.");
  return `${text}?`;
}

async function ensurePack(ctx: Ctx) {
  const id = customPackId(ctx.room);
  const { error } = await db()
    .from("packs")
    .upsert(
      {
        id,
        name: `${ctx.me.nickname}'s questions`.slice(0, 40),
        blurb: "Written by the host for this room.",
        icon: "cards",
        tone: "raised",
        is_adult: true,
        heat: "spicy",
        status: "hidden",
        min_age: 18,
        section: "after_dark",
        format: "yes_no",
        room_id: ctx.room.id,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
  if (error) throw fromDbError(error);
  return id;
}

export async function addCustom(ctx: Ctx, input: string) {
  requireAllowed(ctx);
  const text = cleanQuestion(input);
  const current = await listCustom(ctx.room);
  if (current.length >= MAX_CUSTOM)
    throw new ApiError("BAD_REQUEST", "Up to 30 questions per room.");
  const packId = await ensurePack(ctx);
  const { error } = await db().from("questions").insert({ pack_id: packId, text });
  if (error) throw fromDbError(error);
  return listCustom(ctx.room);
}

export async function removeCustom(ctx: Ctx, questionId: string) {
  requireAllowed(ctx);
  const { error } = await db()
    .from("questions")
    .delete()
    .eq("id", questionId)
    .eq("pack_id", customPackId(ctx.room));
  if (error) throw fromDbError(error);
  return listCustom(ctx.room);
}

/** Plays the room's own questions: the room becomes 18+ so no minor can join later. */
export async function useCustom(ctx: Ctx) {
  requireAllowed(ctx);
  const questions = await listCustom(ctx.room);
  if (questions.length < MIN_CUSTOM_TO_PLAY)
    throw new ApiError("BAD_REQUEST", "Write at least 5 questions first.");
  const { error } = await db()
    .from("rooms")
    .update({
      pack_id: customPackId(ctx.room),
      min_age: 18,
      question_count: Math.min(ctx.room.question_count ?? questions.length, questions.length),
    })
    .eq("id", ctx.room.id);
  if (error) throw fromDbError(error);
}

/** Whether a pack is this room's own custom pack (for rematches, which keep it). */
export function isOwnCustom(room: RoomRow, packId: string) {
  return packId === customPackId(room);
}
