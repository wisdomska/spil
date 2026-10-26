import "server-only";
import { dailyShare, dayKey, pickDaily, streakFromDays } from "@/lib/game";
import { getAdminClient } from "@/lib/supabase/admin";
import { ApiError, fromDbError } from "./errors";

/** The pack the Daily Spill draws from: 13+, so everyone old enough to play can answer. */
export const DAILY_PACK = "classic";

export type DailyState = {
  day: string;
  question: { id: string; text: string };
  mine: "yes" | "no" | null;
  /** Share of yes once enough answered; null before that or before I answer. */
  share: number | null;
  total: number;
  /** Days in a row answered, ending today, from my own answers (so it follows an account). */
  streak: number;
};

async function todaysQuestion(day: string) {
  const { data, error } = await getAdminClient()
    .from("questions")
    .select("id, text")
    .eq("pack_id", DAILY_PACK)
    .eq("status", "live");
  if (error) throw fromDbError(error);
  const id = pickDaily(
    (data ?? []).map((q) => q.id),
    day,
  );
  const question = (data ?? []).find((q) => q.id === id);
  if (!question) throw new ApiError("NOT_FOUND");
  return question;
}

export async function dailyState(userId: string, now = Date.now()): Promise<DailyState> {
  const day = dayKey(now);
  const db = getAdminClient();
  const [question, mine, counts, history] = await Promise.all([
    todaysQuestion(day),
    db.from("daily_answers").select("value").eq("day", day).eq("user_id", userId).maybeSingle(),
    db.from("daily_answers").select("value").eq("day", day),
    db
      .from("daily_answers")
      .select("day")
      .eq("user_id", userId)
      .order("day", { ascending: false })
      .limit(400),
  ]);
  if (mine.error) throw fromDbError(mine.error);
  if (history.error) throw fromDbError(history.error);
  if (counts.error) throw fromDbError(counts.error);
  const rows = counts.data ?? [];
  const yes = rows.filter((r) => r.value === "yes").length;
  const answered = (mine.data?.value as "yes" | "no" | undefined) ?? null;
  return {
    day,
    question,
    mine: answered,
    share: answered ? dailyShare(yes, rows.length) : null,
    total: answered ? rows.length : 0,
    streak: streakFromDays(
      (history.data ?? []).map((r) => r.day),
      day,
    ),
  };
}

/** Saves today's answer once; a second answer on the same day keeps the first. */
export async function answerDaily(userId: string, value: "yes" | "no", now = Date.now()) {
  const day = dayKey(now);
  const question = await todaysQuestion(day);
  const { error } = await getAdminClient()
    .from("daily_answers")
    .upsert(
      { day, user_id: userId, question_id: question.id, value },
      { onConflict: "day,user_id", ignoreDuplicates: true },
    );
  if (error) throw fromDbError(error);
  return dailyState(userId, now);
}
