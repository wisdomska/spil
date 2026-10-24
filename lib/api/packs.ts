import "server-only";
import { getFlags } from "@/lib/flags";
import { packsForFloor, type MinAge } from "@/lib/game";
import { getAdminClient } from "@/lib/supabase/admin";
import { ApiError, fromDbError } from "./errors";
import type { Pack } from "./types";

/** Live packs with at least one live question, in admin sort order (spec section 12). */
async function allLivePacks(): Promise<Pack[]> {
  const db = getAdminClient();
  const [packs, questions] = await Promise.all([
    db.from("packs").select("*").eq("status", "live").order("sort_order").order("name"),
    db.from("questions").select("pack_id").eq("status", "live"),
  ]);
  if (packs.error) throw fromDbError(packs.error);
  if (questions.error) throw fromDbError(questions.error);
  const counts = new Map<string, number>();
  for (const q of questions.data ?? []) counts.set(q.pack_id, (counts.get(q.pack_id) ?? 0) + 1);
  return (packs.data ?? [])
    .filter((p) => (counts.get(p.id) ?? 0) > 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      blurb: p.blurb,
      icon: p.icon,
      tone: p.tone,
      isAdult: p.min_age >= 18,
      heat: p.heat,
      minAge: p.min_age as MinAge,
      region: p.region,
      sortOrder: p.sort_order,
      questionCount: counts.get(p.id) ?? 0,
    }));
}

/**
 * Live packs a player whose band starts at `floor` may see (SPIL-02). Under 18 never receives
 * adult packs at all; with the "18+ packs" flag off nobody does.
 */
export async function livePacks(floor: MinAge): Promise<Pack[]> {
  const [packs, flags] = await Promise.all([allLivePacks(), getFlags()]);
  return packsForFloor(packs, floor, flags.adult_packs_enabled);
}

/** A live pack the floor may play, or PACK_UNAVAILABLE / PACK_NOT_ALLOWED. */
export async function requireLivePack(id: string, floor: MinAge): Promise<Pack> {
  const pack = (await livePacks(18)).find((p) => p.id === id);
  if (!pack) throw new ApiError("PACK_UNAVAILABLE");
  if (pack.minAge > floor) throw new ApiError("PACK_NOT_ALLOWED");
  return pack;
}
