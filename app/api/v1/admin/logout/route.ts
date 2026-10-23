import { route } from "@/lib/api/handler";
import { audit, findAdmin } from "@/lib/admin/server";
import { getServerClient, getUserId } from "@/lib/supabase/server";

/** POST /admin/logout: ends the session (cookie cleared) and notes it in the audit log. */
export const POST = route(async (request) => {
  const userId = await getUserId(request);
  const admin = userId ? await findAdmin(userId) : null;
  if (admin) await audit(admin, "signed_out", "Admin console");
  const supabase = await getServerClient();
  await supabase.auth.signOut({ scope: "local" });
  return {};
});
