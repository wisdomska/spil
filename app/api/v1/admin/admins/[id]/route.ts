import { ApiError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { checkAdminChange, isRole } from "@/lib/admin/roles";
import { patchAdmin } from "@/lib/admin/schemas";
import { audit, requireAdmin } from "@/lib/admin/server";
import { getAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

async function loadAll() {
  const { data, error } = await getAdminClient()
    .from("admins")
    .select("user_id, name, email, role");
  if (error) throw new ApiError("INTERNAL");
  return (data ?? [])
    .filter((a) => isRole(a.role))
    .map((a) => ({ userId: a.user_id, name: a.name, email: a.email, role: a.role }));
}

function guard(code: ReturnType<typeof checkAdminChange>) {
  if (code === "SELF") throw new ApiError("CANNOT_CHANGE_SELF");
  if (code === "LAST_OWNER") throw new ApiError("LAST_OWNER");
}

/** PATCH /admin/admins/:id: change another admin's role. Owner only; one owner always stays. */
export const PATCH = route<Ctx>(async (request, { params }) => {
  const me = await requireAdmin(request, "admins.manage");
  const { id } = await params;
  const { role } = await readBody(request, patchAdmin);
  const admins = await loadAll();
  const target = admins.find((a) => a.userId === id);
  if (!target) throw new ApiError("NOT_FOUND", "No admin with that id.");
  guard(checkAdminChange(me, target, admins, { role }));
  if (target.role === role) return {};
  const { error } = await getAdminClient().from("admins").update({ role }).eq("user_id", id);
  if (error) throw new ApiError("INTERNAL");
  await audit(me, "admin_role_changed", target.email, { role: target.role }, { role });
  return {};
});

/** DELETE /admin/admins/:id: remove an admin. Deletes their auth user, so access ends at once. */
export const DELETE = route<Ctx>(async (request, { params }) => {
  const me = await requireAdmin(request, "admins.manage");
  const { id } = await params;
  const admins = await loadAll();
  const target = admins.find((a) => a.userId === id);
  if (!target) throw new ApiError("NOT_FOUND", "No admin with that id.");
  guard(checkAdminChange(me, target, admins, { remove: true }));
  const db = getAdminClient();
  const { error } = await db.from("admins").delete().eq("user_id", id);
  if (error) throw new ApiError("INTERNAL");
  // Admin accounts exist only for the console, so the auth user goes too (ends their sessions).
  await db.auth.admin.deleteUser(id);
  await audit(
    me,
    "admin_removed",
    target.email,
    { name: target.name, email: target.email, role: target.role },
    null,
  );
  return {};
});
