import { ApiError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { audit, requireAdmin } from "@/lib/admin/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { IS_PROD } from "@/lib/supabase/env";

/**
 * POST /admin/reset-data: local and staging only. Deletes every room (players, answers and
 * results go with them), report, message and play stat, and zeroes question counters. Packs,
 * questions, settings, admins and the audit log stay.
 */
export const POST = route(async (request) => {
  if (IS_PROD) throw new ApiError("NOT_FOUND");
  const me = await requireAdmin(request, "data.reset");
  const db = getAdminClient();
  const all = "00000000-0000-0000-0000-000000000000";
  const steps = await Promise.all([
    db.from("reports").delete().neq("id", all),
    db.from("messages").delete().neq("id", all),
  ]);
  const rooms = await db.from("rooms").delete().neq("id", all);
  const stats = await Promise.all([
    db.from("stats_daily").delete().gte("day", "1970-01-01"),
    db.from("pack_plays").delete().gte("day", "1970-01-01"),
    db
      .from("questions")
      .update({ yes_count: 0, answered_count: 0, report_count: 0 })
      .neq("id", all),
  ]);
  if ([...steps, rooms, ...stats].some((r) => r.error)) throw new ApiError("INTERNAL");
  await audit(me, "data_reset", "Everything");
  return {};
});
