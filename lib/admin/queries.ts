import "server-only";
import { ApiError } from "@/lib/api/errors";
import { getAdminClient } from "@/lib/supabase/admin";
import type { Counts } from "./types";

export const ACTIVE_STATUSES = ["lobby", "answering", "guessing", "ready"] as const;

/** Rooms still in play: not finished or closed, and younger than the 24 h join window. */
export const activeSince = () => new Date(Date.now() - 24 * 3600_000).toISOString();

function count(result: { count: number | null; error: unknown }) {
  if (result.error) throw new ApiError("INTERNAL");
  return result.count ?? 0;
}

/** Badge numbers for the console navigation. */
export async function getCounts(): Promise<Counts> {
  const db = getAdminClient();
  const head = { count: "exact" as const, head: true };
  const [liveRooms, packs, questions, openReports, newMessages] = await Promise.all([
    db
      .from("rooms")
      .select("id", head)
      .in("status", [...ACTIVE_STATUSES])
      .gte("created_at", activeSince()),
    db.from("packs").select("id", head),
    db.from("questions").select("id", head),
    db.from("reports").select("id", head).eq("status", "open"),
    db.from("messages").select("id", head).eq("status", "new"),
  ]);
  return {
    liveRooms: count(liveRooms),
    packs: count(packs),
    questions: count(questions),
    openReports: count(openReports),
    newMessages: count(newMessages),
  };
}
