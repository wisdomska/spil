import { ApiError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { passwordMatches } from "@/lib/admin/passwords";
import { audit, invalidateAdminCache, isUniqueViolation, requireAdmin } from "@/lib/admin/server";
import { patchMe } from "@/lib/admin/schemas";
import { rateLimit } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase/admin";

/** GET /admin/me: the signed-in admin. */
export const GET = route(async (request) => requireAdmin(request, "account.self"));

/** PATCH /admin/me: edit my name and sign-in email. Needs the current password. */
export const PATCH = route(async (request) => {
  const me = await requireAdmin(request, "account.self");
  const body = await readBody(request, patchMe);
  // Current-password checks share the sign-in limit so they cannot be used to guess.
  await rateLimit("adminLogin", `account:${me.userId}`);
  if (!(await passwordMatches(me.email, body.currentPassword)))
    throw new ApiError("WRONG_PASSWORD");
  const db = getAdminClient();
  if (body.email !== me.email) {
    const taken = await db.from("admins").select("user_id").eq("email", body.email).maybeSingle();
    if (taken.data) throw new ApiError("EMAIL_TAKEN");
    const { error } = await db.auth.admin.updateUserById(me.userId, {
      email: body.email,
      email_confirm: true,
    });
    if (error) throw new ApiError("EMAIL_TAKEN");
  }
  const { error } = await db
    .from("admins")
    .update({ name: body.name, email: body.email })
    .eq("user_id", me.userId);
  invalidateAdminCache();
  if (isUniqueViolation(error)) throw new ApiError("EMAIL_TAKEN");
  if (error) throw new ApiError("INTERNAL");
  const next = { ...me, name: body.name, email: body.email };
  await audit(
    next,
    "account_edited",
    me.email,
    { name: me.name, email: me.email },
    { name: next.name, email: next.email },
  );
  return next;
});
