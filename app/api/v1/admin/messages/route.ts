import { ApiError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { requireAdmin } from "@/lib/admin/server";
import type { AdminMessage } from "@/lib/admin/types";
import { getAdminClient } from "@/lib/supabase/admin";

/** GET /admin/messages: the contact form inbox, newest first. */
export const GET = route(async (request): Promise<AdminMessage[]> => {
  await requireAdmin(request, "inbox.read");
  const { data, error } = await getAdminClient()
    .from("messages")
    .select("id, name, email, body, status, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new ApiError("INTERNAL");
  return (data ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    body: m.body,
    status: m.status,
    createdAt: m.created_at,
  }));
});
