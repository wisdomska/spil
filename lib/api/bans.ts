import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * Banned players (admin console, owner request 2026-11-12). Every player request checks this, so
 * the active bans are read once every 15 seconds per server instance, not on every call. An
 * admin's own instance clears the cache when they ban or unban, so the change shows at once there.
 */
const TTL_MS = 15_000;
let cache: { at: number; ids: Set<string> } | null = null;

export function invalidateBans() {
  cache = null;
}

export async function isBanned(userId: string): Promise<boolean> {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    const { data, error } = await getAdminClient()
      .from("user_bans")
      .select("user_id, expires_at")
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
    // A failed read lets the request through: a database blip must not lock everyone out.
    if (error) return false;
    cache = { at: Date.now(), ids: new Set((data ?? []).map((b) => b.user_id)) };
  }
  return cache.ids.has(userId);
}
