import { requireUser } from "@/lib/api/auth";
import { fromDbError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { findRoom } from "@/lib/api/rooms";
import { rateLimit } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase/admin";
import { report } from "@/lib/validation/schemas";

/** POST /reports: flag a question or nickname for the admin Reports queue. */
export const POST = route(async (request) => {
  const userId = await requireUser(request);
  const body = await readBody(request, report);
  await rateLimit("report", userId);
  const room = body.roomCode ? await findRoom(body.roomCode.toUpperCase()) : null;
  const { error } = await getAdminClient()
    .from("reports")
    .insert({
      type: body.type,
      question_id: body.questionId ?? null,
      player_id: body.playerId ?? null,
      room_id: room?.id ?? null,
      reason: body.reason,
      reporter_user_id: userId,
    });
  if (error) throw fromDbError(error);
  if (body.questionId) {
    const db = getAdminClient();
    const { data } = await db
      .from("questions")
      .select("report_count")
      .eq("id", body.questionId)
      .maybeSingle();
    if (data)
      await db
        .from("questions")
        .update({ report_count: data.report_count + 1 })
        .eq("id", body.questionId);
  }
  return {};
});
