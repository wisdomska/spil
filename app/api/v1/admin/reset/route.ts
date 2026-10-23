import { ApiError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { audit, requireAdmin } from "@/lib/admin/server";
import { completeReset } from "@/lib/admin/schemas";
import { getAdminClient } from "@/lib/supabase/admin";
import { getServerClient } from "@/lib/supabase/server";

/**
 * POST /admin/reset: sets a new password after the recovery step (6-digit code or the reset
 * link) gave the browser a session. Only admins get this far; the session is then ended so they
 * sign in again with the new password.
 */
export const POST = route(async (request) => {
  const me = await requireAdmin(request, "account.self");
  const { password } = await readBody(request, completeReset);
  const { error } = await getAdminClient().auth.admin.updateUserById(me.userId, { password });
  if (error) throw new ApiError("BAD_REQUEST", error.message);
  await audit(me, "password_reset", me.email);
  const supabase = await getServerClient();
  await supabase.auth.signOut({ scope: "local" });
  return {};
});
