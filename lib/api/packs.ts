import "server-only";
import { getFlags } from "@/lib/flags";
import { getAdminClient } from "@/lib/supabase/admin";
import { ApiError, fromDbError } from "./errors";
import type { Pack } from "./types";

/** Live packs with at least one live question, in admin sort order (spec section 12). */
export async function livePacks(): Promise<Pack[]> {
  const db = getAdminClient();
  const [packs, questions, flags] = await Promise.all([
    db.from("packs").select("*").eq("status", "live").order("sort_order").order("name"),
    db.from("questions").select("pack_id").eq("status", "live"),
    getFlags(),
  ]);
  if (packs.error) throw fromDbError(packs.error);
  if (questions.error) throw fromDbError(questions.error);
  const counts = new Map<string, number>();
  for (const q of questions.data ?? []) counts.set(q.pack_id, (counts.get(q.pack_id) ?? 0) + 1);
  return (packs.data ?? [])
    .filter((p) => (counts.get(p.id) ?? 0) > 0)
    .filter((p) => flags.adult_packs_enabled || !p.is_adult)
    .map((p) => ({
      id: p.id,
      name: p.name,
      blurb: p.blurb,
      icon: p.icon,
      tone: p.tone,
      isAdult: p.is_adult,
      heat: p.heat,
      region: p.region,
      sortOrder: p.sort_order,
      questionCount: counts.get(p.id) ?? 0,
    }));
}

export async function requireLivePack(id: string): Promise<Pack> {
  const pack = (await livePacks()).find((p) => p.id === id);
  if (!pack) throw new ApiError("PACK_UNAVAILABLE");
  return pack;
}
