import "server-only";
import { cacheLife } from "next/cache";
import { ROOM_COUNT_WINDOW_MS } from "@/lib/game";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * SPIL-22: rooms whose reveal started in the last 7 days. Cached for 10 minutes; a count is all
 * that leaves the database. Builds without database access fall back to 0 (the line hides).
 */
export async function roomsThisWeek(): Promise<number> {
  "use cache";
  cacheLife({ stale: 600, revalidate: 600, expire: 3600 });
  try {
    const since = new Date(Date.now() - ROOM_COUNT_WINDOW_MS).toISOString();
    const { count, error } = await getAdminClient()
      .from("rooms")
      .select("id", { count: "exact", head: true })
      .gte("reveal_at", since);
    return error ? 0 : (count ?? 0);
  } catch {
    return 0;
  }
}
