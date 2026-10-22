import { ApiError, fromDbError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { getAdminClient } from "@/lib/supabase/admin";

/** GET /api/cron/expire: Vercel Cron, daily. Closes stale lobbies and deletes rooms after 7 days. */
export const GET = route(async (request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    throw new ApiError("UNAUTHENTICATED");
  const { data, error } = await getAdminClient().rpc("expire_rooms");
  if (error) throw fromDbError(error);
  return { ok: true, ...(data as object) };
});
