import "server-only";
import { ApiError } from "@/lib/api/errors";
import { getAdminClient } from "@/lib/supabase/admin";
import { dedupeKey, type QStatus } from "./questions";
import { fetchAll } from "./server";
import type { AdminQuestion } from "./types";

type Row = {
  id: string;
  pack_id: string;
  text: string;
  status: QStatus;
  yes_count: number;
  answered_count: number;
  report_count: number;
  updated_at: string;
};

const toQuestion = (q: Row): AdminQuestion => ({
  id: q.id,
  packId: q.pack_id,
  text: q.text,
  status: q.status,
  yes: q.yes_count,
  answered: q.answered_count,
  reports: q.report_count,
  updatedAt: q.updated_at,
});

/** Every question, newest edits first. Optional pack and status filters (used by the export). */
export async function listQuestions(filter: { packId?: string; status?: QStatus } = {}) {
  const db = getAdminClient();
  const rows = await fetchAll<Row>((from, to) => {
    let q = db
      .from("questions")
      .select("id, pack_id, text, status, yes_count, answered_count, report_count, updated_at")
      .order("updated_at", { ascending: false })
      .order("id");
    if (filter.packId) q = q.eq("pack_id", filter.packId);
    if (filter.status) q = q.eq("status", filter.status);
    return q.range(from, to);
  });
  return rows.map(toQuestion);
}

export async function findQuestion(id: string) {
  const { data } = await getAdminClient()
    .from("questions")
    .select("id, pack_id, text, status, yes_count, answered_count, report_count, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!data) throw new ApiError("NOT_FOUND", "No question with that id.");
  return toQuestion(data);
}

/** Existing (pack, text) keys, to skip duplicates on add and import. */
export async function existingKeys(packIds?: string[]) {
  const db = getAdminClient();
  const rows = await fetchAll<{ id: string; pack_id: string; text: string }>((from, to) => {
    let q = db.from("questions").select("id, pack_id, text").order("id");
    if (packIds) q = q.in("pack_id", packIds);
    return q.range(from, to);
  });
  return rows.map((r) => ({ id: r.id, packId: r.pack_id, text: r.text }));
}

export function hasDuplicate(
  rows: ReadonlyArray<{ id: string; packId: string; text: string }>,
  packId: string,
  text: string,
  exceptId?: string,
) {
  const key = dedupeKey(packId, text);
  return rows.some((r) => r.id !== exceptId && dedupeKey(r.packId, r.text) === key);
}

/** Inserts in chunks so a large import stays under request size limits. */
export async function insertQuestions(
  rows: Array<{ packId: string; text: string; status: QStatus }>,
) {
  const db = getAdminClient();
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db
      .from("questions")
      .insert(
        rows.slice(i, i + 500).map((r) => ({ pack_id: r.packId, text: r.text, status: r.status })),
      );
    if (error) throw new ApiError("INTERNAL");
  }
}

export async function packNames() {
  const { data, error } = await getAdminClient().from("packs").select("id, name");
  if (error) throw new ApiError("INTERNAL");
  return data ?? [];
}
