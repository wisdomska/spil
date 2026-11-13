import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { userAction } from "@/lib/admin/schemas";
import { requireAdmin } from "@/lib/admin/server";
import type { AdminUserDetail } from "@/lib/admin/types";
import {
  banUser,
  deleteUser,
  kickUser,
  renameUser,
  signOutUser,
  unbanUser,
} from "@/lib/admin/user-actions";
import { getAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

async function idOf(ctx: Ctx) {
  const { id } = await ctx.params;
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) throw new ApiError("NOT_FOUND");
  return parsed.data;
}

/** GET /admin/users/:id: one person in full (rooms, names, crews, reports, ban). Never an email. */
export const GET = route<Ctx>(async (request, ctx): Promise<AdminUserDetail> => {
  await requireAdmin(request, "users.read");
  const id = await idOf(ctx);
  const { data, error } = await getAdminClient().rpc("admin_user_detail", { p_user: id });
  if (error) throw new ApiError("INTERNAL");
  if (!data) throw new ApiError("NOT_FOUND");
  return data as AdminUserDetail;
});

/**
 * POST /admin/users/:id: ban (for 1, 7 or 30 days, or until lifted), unban, remove from live
 * rooms, sign out everywhere, rename, or delete (owners only, typed confirmation). Every action
 * is in the audit log.
 */
export const POST = route<Ctx>(async (request, ctx) => {
  const id = await idOf(ctx);
  const body = await readBody(request, userAction);
  const me = await requireAdmin(request, body.action === "delete" ? "users.delete" : "users.act");
  switch (body.action) {
    case "ban":
      await banUser(me, id, body);
      return {};
    case "unban":
      await unbanUser(me, id);
      return {};
    case "kick":
      return { rooms: await kickUser(me, id) };
    case "signout":
      await signOutUser(me, id);
      return {};
    case "rename":
      await renameUser(me, id, body.name);
      return {};
    case "delete":
      await deleteUser(me, id, body.confirm);
      return {};
  }
});
