import { ApiError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { requireAdmin } from "@/lib/admin/server";
import type { AuditRow } from "@/lib/admin/types";
import { getAdminClient } from "@/lib/supabase/admin";

/** GET /admin/audit: the last 300 admin actions (all are stored). */
export const GET = route(async (request): Promise<AuditRow[]> => {
  await requireAdmin(request, "audit.read");
  const { data, error } = await getAdminClient()
    .from("audit_log")
    .select("id, at, who, action, target")
    .order("at", { ascending: false })
    .order("id", { ascending: false })
    .limit(300);
  if (error) throw new ApiError("INTERNAL");
  return data ?? [];
});
