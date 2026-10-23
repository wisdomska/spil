import { ApiError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { existingKeys, findQuestion, hasDuplicate, packNames } from "@/lib/admin/question-store";
import { checkQuestion, normalizeQuestion } from "@/lib/admin/questions";
import { canPatchQuestion } from "@/lib/admin/roles";
import { patchQuestion } from "@/lib/admin/schemas";
import { audit, isFkViolation, requireAdmin } from "@/lib/admin/server";
import { getAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

const snap = (q: { packId: string; text: string; status: string }) => ({
  pack: q.packId,
  text: q.text,
  status: q.status,
});

/** PATCH /admin/questions/:id: edit text, pack or status. Moderators may only hide. */
export const PATCH = route<Ctx>(async (request, { params }) => {
  const me = await requireAdmin(request, "questions.hide");
  const { id } = await params;
  const body = await readBody(request, patchQuestion);
  if (!canPatchQuestion(me.role, body)) throw new ApiError("FORBIDDEN");
  const before = await findQuestion(id);
  const next = {
    packId: body.packId ?? before.packId,
    text: body.text !== undefined ? normalizeQuestion(body.text) : before.text,
    status: body.status ?? before.status,
  };
  if (body.text !== undefined) {
    const problem = checkQuestion(next.text);
    if (problem) throw new ApiError("QUESTION_INVALID", problem);
  }
  if (body.packId && !(await packNames()).some((p) => p.id === body.packId))
    throw new ApiError("NOT_FOUND", "No pack with that id.");
  if (
    (body.text !== undefined || body.packId) &&
    hasDuplicate(await existingKeys([next.packId]), next.packId, next.text, id)
  )
    throw new ApiError("DUPLICATE");
  const { error } = await getAdminClient()
    .from("questions")
    .update({ pack_id: next.packId, text: next.text, status: next.status })
    .eq("id", id);
  if (error) throw new ApiError("INTERNAL");
  const onlyStatus = body.text === undefined && body.packId === undefined;
  const action = !onlyStatus
    ? "question_edited"
    : next.status === "hidden"
      ? "question_hidden"
      : next.status === "live" && before.status === "hidden"
        ? "question_shown"
        : "question_edited";
  await audit(me, action, next.text, snap(before), snap(next));
  return {};
});

/**
 * DELETE /admin/questions/:id: removes a question for good and closes its open reports. Refused
 * while a room (kept 7 days) still uses it: hide it instead.
 */
export const DELETE = route<Ctx>(async (request, { params }) => {
  const me = await requireAdmin(request, "questions.write");
  const { id } = await params;
  const before = await findQuestion(id);
  const db = getAdminClient();
  const used = await db
    .from("room_questions")
    .select("room_id", { count: "exact", head: true })
    .eq("question_id", id);
  if ((used.count ?? 0) > 0) throw new ApiError("QUESTION_IN_USE");
  await db
    .from("reports")
    .update({ status: "actioned", resolved_at: new Date().toISOString(), resolved_by: me.userId })
    .eq("question_id", id)
    .eq("status", "open");
  const { error } = await db.from("questions").delete().eq("id", id);
  if (isFkViolation(error)) throw new ApiError("QUESTION_IN_USE");
  if (error) throw new ApiError("INTERNAL");
  await audit(me, "question_deleted", before.text, snap(before), null);
  return {};
});
