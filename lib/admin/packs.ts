import "server-only";
import { ApiError } from "@/lib/api/errors";
import { PACK_ICONS } from "@/components/brand/PackGlyph";
import { getAdminClient } from "@/lib/supabase/admin";
import { fetchAll } from "./server";
import type { AdminPack } from "./types";

type PackRow = {
  id: string;
  name: string;
  blurb: string;
  icon: string;
  tone: AdminPack["tone"];
  is_adult: boolean;
  heat: AdminPack["heat"];
  region: string | null;
  status: AdminPack["status"];
  sort_order: number;
  updated_at: string;
};

export const packSnapshot = (p: PackRow) => ({
  name: p.name,
  blurb: p.blurb,
  icon: p.icon,
  tone: p.tone,
  isAdult: p.is_adult,
  heat: p.heat,
  region: p.region,
  status: p.status,
  sortOrder: p.sort_order,
});

export async function listPacks(): Promise<AdminPack[]> {
  const db = getAdminClient();
  const [packs, questions, plays] = await Promise.all([
    db.from("packs").select("*").order("sort_order").order("name"),
    fetchAll<{ pack_id: string; status: string }>((from, to) =>
      db.from("questions").select("pack_id, status").range(from, to),
    ),
    fetchAll<{ pack_id: string; started: number | null }>((from, to) =>
      db.from("pack_plays").select("pack_id, started").range(from, to),
    ),
  ]);
  if (packs.error) throw new ApiError("INTERNAL");
  const total = new Map<string, number>();
  const live = new Map<string, number>();
  for (const q of questions) {
    total.set(q.pack_id, (total.get(q.pack_id) ?? 0) + 1);
    if (q.status === "live") live.set(q.pack_id, (live.get(q.pack_id) ?? 0) + 1);
  }
  const games = new Map<string, number>();
  for (const p of plays) games.set(p.pack_id, (games.get(p.pack_id) ?? 0) + (p.started ?? 0));
  return (packs.data ?? []).map((p) => ({
    id: p.id,
    ...packSnapshot(p),
    updatedAt: p.updated_at,
    liveQuestions: live.get(p.id) ?? 0,
    totalQuestions: total.get(p.id) ?? 0,
    games: games.get(p.id) ?? 0,
  }));
}

export function checkIcon(icon: string) {
  if (!Object.hasOwn(PACK_ICONS, icon))
    throw new ApiError("BAD_REQUEST", "Pick an icon from the list.");
}

/** A pack can only go live with at least one live question (design rule). */
export async function liveQuestionCount(packId: string) {
  const { count, error } = await getAdminClient()
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("pack_id", packId)
    .eq("status", "live");
  if (error) throw new ApiError("INTERNAL");
  return count ?? 0;
}

export async function nameTaken(name: string, exceptId?: string) {
  const { data } = await getAdminClient()
    .from("packs")
    .select("id, name")
    .ilike("name", name.replace(/[%_\\]/g, "\\$&"));
  return (data ?? []).some((p) => p.id !== exceptId && p.name.toLowerCase() === name.toLowerCase());
}
