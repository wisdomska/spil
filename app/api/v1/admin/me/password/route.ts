import { ApiError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { passwordMatches } from "@/lib/admin/passwords";
import { audit, requireAdmin } from "@/lib/admin/server";
import { changePassword } from "@/lib/admin/schemas";
import { rateLimit } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase/admin";

/** POST /admin/me/password: change my password (current password required). */
export const POST = route(async (request) => {
  const me = await requireAdmin(request, "account.self");
  const body = await readBody(request, changePassword);
  // Current-password checks share the sign-in limit so they cannot be used to guess.
  await rateLimit("adminLogin", `account:${me.userId}`);
  if (!(await passwordMatches(me.email, body.currentPassword)))
    throw new ApiError("WRONG_PASSWORD");
  const { error } = await getAdminClient().auth.admin.updateUserById(me.userId, {
    password: body.password,
  });
  if (error) throw new ApiError("BAD_REQUEST", error.message);
  await audit(me, "password_changed", me.email);
  return {};
});
