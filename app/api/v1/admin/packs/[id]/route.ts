import { ApiError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { checkIcon, liveQuestionCount, nameTaken, packSnapshot } from "@/lib/admin/packs";
import { packBody } from "@/lib/admin/schemas";
import { audit, isFkViolation, requireAdmin } from "@/lib/admin/server";
import { getAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

async function findPack(id: string) {
  const { data } = await getAdminClient().from("packs").select("*").eq("id", id).maybeSingle();
  if (!data) throw new ApiError("NOT_FOUND", "No pack with that id.");
  return data;
}

/** PATCH /admin/packs/:id: edit every pack field. Going live needs a live question. */
export const PATCH = route<Ctx>(async (request, { params }) => {
  const me = await requireAdmin(request, "packs.write");
  const { id } = await params;
  const body = await readBody(request, packBody);
  checkIcon(body.icon);
  const before = await findPack(id);
  if (await nameTaken(body.name, id)) throw new ApiError("DUPLICATE");
  if (body.status === "live" && (await liveQuestionCount(id)) === 0)
    throw new ApiError("PACK_NOT_READY");
  const { data, error } = await getAdminClient()
    .from("packs")
    .update({
      name: body.name,
      blurb: body.blurb,
      icon: body.icon,
      tone: body.tone,
      min_age: body.minAge,
      section: body.section,
      spice: body.spice,
      // is_adult stays in step with min_age; adult packs keep their heat level (or start at
      // "spicy") because the database requires one (packs_heat_matches_adult).
      is_adult: body.minAge === 18,
      heat: body.minAge === 18 ? (before.heat ?? "spicy") : null,
      region: body.region,
      status: body.status,
      sort_order: body.sortOrder,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) throw new ApiError("INTERNAL");
  await audit(me, "pack_edited", data.name, packSnapshot(before), packSnapshot(data));
  return {};
});

/**
 * DELETE /admin/packs/:id: removes the pack and its questions. Refused while rooms (kept for 7
 * days) still point at the pack or its questions: hide it instead.
 */
export const DELETE = route<Ctx>(async (request, { params }) => {
  const me = await requireAdmin(request, "packs.write");
  const { id } = await params;
  const before = await findPack(id);
  const db = getAdminClient();
  const rooms = await db
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .eq("pack_id", id);
  if ((rooms.count ?? 0) > 0) throw new ApiError("PACK_IN_USE");
  const { error } = await db.from("packs").delete().eq("id", id);
  if (isFkViolation(error)) throw new ApiError("PACK_IN_USE");
  if (error) throw new ApiError("INTERNAL");
  await audit(me, "pack_deleted", before.name, { id, ...packSnapshot(before) }, null);
  return {};
});
