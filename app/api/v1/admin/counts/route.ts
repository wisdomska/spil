import { route } from "@/lib/api/handler";
import { getCounts } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/admin/server";

/** GET /admin/counts: navigation badges (live rooms, packs, questions, open reports, new mail). */
export const GET = route(async (request) => {
  await requireAdmin(request, "overview.read");
  return getCounts();
});
