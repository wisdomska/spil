import { ApiError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { addAdmin } from "@/lib/admin/schemas";
import { audit, invalidateAdminCache, requireAdmin } from "@/lib/admin/server";
import type { AdminAccount } from "@/lib/admin/types";
import { getAdminClient } from "@/lib/supabase/admin";

/** GET /admin/admins: every admin account. Owner only. */
export const GET = route(async (request): Promise<AdminAccount[]> => {
  await requireAdmin(request, "admins.manage");
  const { data, error } = await getAdminClient()
    .from("admins")
    .select("user_id, name, email, role, created_at")
    .order("created_at");
  if (error) throw new ApiError("INTERNAL");
  return (data ?? []).map((a) => ({
    userId: a.user_id,
    name: a.name,
    email: a.email,
    role: a.role,
    createdAt: a.created_at,
  }));
});

/**
 * POST /admin/admins: add an admin with a temporary password (the owner shares it privately).
 * Creates the auth user with the service role, already confirmed; public sign-up stays off.
 */
export const POST = route(async (request) => {
  const me = await requireAdmin(request, "admins.manage");
  invalidateAdminCache();
  const body = await readBody(request, addAdmin);
  const db = getAdminClient();
  const taken = await db.from("admins").select("user_id").eq("email", body.email).maybeSingle();
  if (taken.data) throw new ApiError("EMAIL_TAKEN");
  const { data, error } = await db.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
  });
  if (error || !data.user) throw new ApiError("EMAIL_TAKEN");
  const { error: insertError } = await db
    .from("admins")
    .insert({ user_id: data.user.id, email: body.email, name: body.name, role: body.role });
  if (insertError) {
    await db.auth.admin.deleteUser(data.user.id);
    throw new ApiError("INTERNAL");
  }
  await audit(me, "admin_added", body.email, null, {
    name: body.name,
    email: body.email,
    role: body.role,
  });
  return { userId: data.user.id };
});
