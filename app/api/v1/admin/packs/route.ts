import { randomBytes } from "node:crypto";
import { ApiError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { checkIcon, listPacks, nameTaken, packSnapshot } from "@/lib/admin/packs";
import { packSlug } from "@/lib/admin/questions";
import { packBody } from "@/lib/admin/schemas";
import { audit, requireAdmin } from "@/lib/admin/server";
import { getAdminClient } from "@/lib/supabase/admin";

/** GET /admin/packs: every pack with live/total question counts and games played. */
export const GET = route(async (request) => {
  await requireAdmin(request, "packs.read");
  return listPacks();
});

/** POST /admin/packs: create a pack. New packs cannot start live (they have no questions yet). */
export const POST = route(async (request) => {
  const me = await requireAdmin(request, "packs.write");
  const body = await readBody(request, packBody);
  checkIcon(body.icon);
  if (body.status === "live") throw new ApiError("PACK_NOT_READY");
  if (await nameTaken(body.name)) throw new ApiError("DUPLICATE");
  const id = packSlug(body.name, randomBytes(2).toString("hex"));
  const { data, error } = await getAdminClient()
    .from("packs")
    .insert({
      id,
      name: body.name,
      blurb: body.blurb,
      icon: body.icon,
      tone: body.tone,
      min_age: body.minAge,
      section: body.section,
      spice: body.spice,
      // is_adult stays in step with min_age for anything that still reads it.
      is_adult: body.minAge === 18,
      region: body.region,
      status: body.status,
      sort_order: body.sortOrder,
    })
    .select("*")
    .single();
  if (error || !data) throw new ApiError("INTERNAL");
  await audit(me, "pack_created", body.name, null, { id, ...packSnapshot(data) });
  return { id };
});
