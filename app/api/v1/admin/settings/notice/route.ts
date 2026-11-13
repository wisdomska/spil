import { ApiError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { putNotice } from "@/lib/admin/schemas";
import { audit, requireAdmin } from "@/lib/admin/server";
import { invalidateConfig } from "@/lib/flags";
import { getAdminClient } from "@/lib/supabase/admin";

/** PUT /admin/settings/notice: the one-line notice every player sees while on. Owner only. */
export const PUT = route(async (request) => {
  const me = await requireAdmin(request, "settings.write");
  const body = await readBody(request, putNotice);
  const db = getAdminClient();
  const { data: before } = await db.from("settings").select("notice, notice_on").maybeSingle();
  const { error } = await db
    .from("settings")
    .update({ notice: body.text, notice_on: body.on })
    .eq("id", true);
  if (error) throw new ApiError("INTERNAL");
  invalidateConfig();
  await audit(
    me,
    "notice_changed",
    body.on ? body.text : "Notice off",
    before ? { text: before.notice, on: before.notice_on } : null,
    body,
  );
  return body;
});
