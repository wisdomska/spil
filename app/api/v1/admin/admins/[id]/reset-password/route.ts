import { ApiError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { temporaryPassword } from "@/lib/admin/passwords";
import { audit, findAdmin, requireAdmin } from "@/lib/admin/server";
import { getAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /admin/admins/:id/reset-password: gives another admin a new temporary password, returned
 * once for the owner to pass on privately. It is never stored or logged.
 */
export const POST = route<Ctx>(async (request, { params }) => {
  const me = await requireAdmin(request, "admins.manage");
  const { id } = await params;
  if (id === me.userId) throw new ApiError("CANNOT_CHANGE_SELF");
  const target = await findAdmin(id);
  if (!target) throw new ApiError("NOT_FOUND", "No admin with that id.");
  const password = temporaryPassword();
  const { error } = await getAdminClient().auth.admin.updateUserById(id, { password });
  if (error) throw new ApiError("INTERNAL");
  await audit(me, "admin_password_reset", target.email);
  return { password };
});
