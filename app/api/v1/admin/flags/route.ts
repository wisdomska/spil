import { ApiError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { patchFlag } from "@/lib/admin/schemas";
import { audit, requireAdmin } from "@/lib/admin/server";
import { invalidateConfig } from "@/lib/flags";
import { getAdminClient } from "@/lib/supabase/admin";

/** PATCH /admin/flags: turn one feature flag on or off. Owner only. */
export const PATCH = route(async (request) => {
  const me = await requireAdmin(request, "settings.write");
  const { key, enabled } = await readBody(request, patchFlag);
  const db = getAdminClient();
  const { data: before } = await db
    .from("feature_flags")
    .select("enabled")
    .eq("key", key)
    .maybeSingle();
  const { error } = await db.from("feature_flags").upsert({ key, enabled });
  if (error) throw new ApiError("INTERNAL");
  invalidateConfig();
  await audit(
    me,
    "flag_changed",
    `${key} ${enabled ? "on" : "off"}`,
    { [key]: before?.enabled ?? null },
    { [key]: enabled },
  );
  return { key, enabled };
});
