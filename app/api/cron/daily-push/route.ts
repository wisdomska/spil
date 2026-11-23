import { ApiError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { todaysQuestion } from "@/lib/api/daily";
import { dayKey } from "@/lib/game";
import { sendDailyReminder } from "@/lib/push/server";

/**
 * GET /api/cron/daily-push: Vercel Cron, once a day. Reminds every device that wants it, and
 * whose person has not answered yet, that Today's Spill is up, quoting the question.
 */
export const GET = route(async (request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    throw new ApiError("UNAUTHENTICATED");
  const day = dayKey(Date.now());
  const question = await todaysQuestion(day);
  return { ok: true, day, ...(await sendDailyReminder(day, question.text)) };
});
