import { ApiError } from "@/lib/api/errors";
import { clientIp, readBody, route } from "@/lib/api/handler";
import { audit, findAdmin } from "@/lib/admin/server";
import { login } from "@/lib/admin/schemas";
import { rateLimit } from "@/lib/ratelimit";
import { getServerClient } from "@/lib/supabase/server";

/**
 * POST /admin/login: email + password sign-in, 5 tries per 15 minutes per IP. Signs in on the
 * server so the session cookie is set by @supabase/ssr, then checks the `admins` allow-list.
 * Non-admins get the same answer as a wrong password and their session is dropped.
 */
export const POST = route(async (request) => {
  await rateLimit("adminLogin", clientIp(request));
  const body = await readBody(request, login);
  const supabase = await getServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(body);
  if (error || !data.user) throw new ApiError("INVALID_CREDENTIALS");
  const admin = await findAdmin(data.user.id);
  if (!admin) {
    await supabase.auth.signOut({ scope: "local" });
    throw new ApiError("INVALID_CREDENTIALS");
  }
  await audit(admin, "signed_in", "Admin console");
  return { me: admin };
});
