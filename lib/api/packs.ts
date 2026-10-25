import "server-only";
import { getFlags } from "@/lib/flags";
import { packsForFloor, type MinAge, type PackFormat } from "@/lib/game";
import { getAdminClient } from "@/lib/supabase/admin";
import { ApiError, fromDbError } from "./errors";
import type { Pack, PackSection } from "./types";

/** Live packs with at least one live question, in admin sort order (spec section 12). */
async function allLivePacks(paymentsOn: boolean): Promise<Pack[]> {
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
      section: p.section as PackSection,
      spice: p.spice,
      region: p.region,
      sortOrder: p.sort_order,
      format: p.format as PackFormat,
      locked: p.premium && paymentsOn,
      questionCount: counts.get(p.id) ?? 0,
    }));
}

/**
 * Live packs a player whose band starts at `floor` may see (SPIL-02). Under 18 never receives
 * adult packs at all; with the "18+ packs" flag off nobody does.
 */
export async function livePacks(floor: MinAge): Promise<Pack[]> {
  const flags = await getFlags();
  const packs = await allLivePacks(flags.payments_enabled);
  return packsForFloor(packs, floor, flags.adult_packs_enabled);
}

/**
 * Up to three questions for a pack's preview (SPIL-08): the ones marked as samples, otherwise
 * the pack's oldest live questions.
 */
export async function previewQuestions(packId: string): Promise<string[]> {
  const db = getAdminClient();
  const pick = (samples: boolean) => {
    let q = db.from("questions").select("text").eq("pack_id", packId).eq("status", "live");
    if (samples) q = q.eq("is_sample", true);
    return q.order("updated_at").order("id").limit(3);
  };
  const marked = await pick(true);
  if (marked.error) throw fromDbError(marked.error);
  if ((marked.data ?? []).length > 0) return marked.data!.map((q) => q.text);
  const first = await pick(false);
  if (first.error) throw fromDbError(first.error);
  return (first.data ?? []).map((q) => q.text);
}

/**
 * A live pack the floor may play, or PACK_UNAVAILABLE / PACK_NOT_ALLOWED. With a format (the
 * room's game), a statement pack in a yes or no mode is not allowed, nor the other way round.
 */
export async function requireLivePack(
  id: string,
  floor: MinAge,
  format?: PackFormat,
): Promise<Pack> {
  const pack = (await livePacks(18)).find((p) => p.id === id);
  if (!pack) throw new ApiError("PACK_UNAVAILABLE");
  if (pack.minAge > floor || (format && pack.format !== format))
    throw new ApiError("PACK_NOT_ALLOWED");
  if (pack.locked) throw new ApiError("PACK_PREMIUM");
  return pack;
}
