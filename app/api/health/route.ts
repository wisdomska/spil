import { route } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import { getAdminClient } from "@/lib/supabase/admin";

/** GET /api/health: one tiny query, so the keep-alive job counts as database activity. */
export const GET = route(async () => {
  const { error } = await getAdminClient().from("settings").select("id").limit(1);
  if (error) throw new ApiError("INTERNAL", "Database unreachable.");
  return { ok: true };
});
