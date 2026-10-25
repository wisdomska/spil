import { requireUser } from "@/lib/api/auth";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { requireMember } from "@/lib/api/rooms";
import { rateLimit } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase/admin";
import { reportAnswer } from "@/lib/validation/schemas";

type Ctx = { params: Promise<{ code: string; answerId: string }> };

/**
 * POST /rooms/:code/answers/:answerId/report: report a written answer (Who Said That?). It is
 * hidden for everyone in the room straight away, and the report reaches the admin console.
 */
export const POST = route<Ctx>(async (request, { params }) => {
  const userId = await requireUser(request);
  const { code, answerId } = await params;
  const body = await readBody(request, reportAnswer);
  const room = await requireMember(code.toUpperCase(), userId);
  await rateLimit("report", userId);
  const db = getAdminClient();
  const { data: answer, error } = await db
    .from("mode_inputs")
    .select("id, player_id, room_id, kind")
    .eq("id", answerId)
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (!answer || answer.room_id !== room.room.id || answer.kind !== "text")
    throw new ApiError("NOT_FOUND");

  const [hide, report] = await Promise.all([
    db.from("mode_inputs").update({ hidden: true }).eq("id", answer.id),
    db.from("reports").insert({
      type: "answer",
      mode_input_id: answer.id,
      player_id: answer.player_id,
      room_id: room.room.id,
      reason: body.reason || "Reported in Who Said That?",
      reporter_user_id: userId,
    }),
  ]);
  if (hide.error) throw fromDbError(hide.error);
  if (report.error) throw fromDbError(report.error);
  return { hidden: true };
});
