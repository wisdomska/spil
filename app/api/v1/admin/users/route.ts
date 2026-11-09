import { ApiError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { pageRange, parsePage, parseSize, type Paged } from "@/lib/admin/paging";
import { requireAdmin } from "@/lib/admin/server";
import type { AdminUser, AdminUserSummary } from "@/lib/admin/types";
import { getAdminClient } from "@/lib/supabase/admin";

const FILTERS = ["all", "accounts", "guests", "new", "active"] as const;

/**
 * GET /admin/users: accounts and guests who played, newest first, one page at a time
 * `{ rows, total, page, size, summary }`. `filter` is all, accounts, guests, new (joined in the
 * last 7 days) or active (seen in the last 7 days); `q` searches usernames and guest names.
 * Read only, and never an email address.
 */
export const GET = route(
  async (request): Promise<Paged<AdminUser> & { summary: AdminUserSummary }> => {
    await requireAdmin(request, "users.read");
    const params = new URL(request.url).searchParams;
    const page = parsePage(params.get("page"));
    const size = parseSize(params.get("size"));
    const raw = params.get("filter");
    const filter = (FILTERS as readonly string[]).includes(raw ?? "") ? raw! : "all";
    const q = (params.get("q") ?? "").trim().slice(0, 40);
    const { from } = pageRange(page, size);

    const db = getAdminClient();
    const [list, summary] = await Promise.all([
      db.rpc("admin_accounts", { p_query: q, p_filter: filter, p_limit: size, p_offset: from }),
      db.rpc("admin_user_summary"),
    ]);
    if (list.error || summary.error) throw new ApiError("INTERNAL");
    const result = list.data as { total: number; rows: AdminUser[] };
    return {
      rows: result.rows,
      total: result.total,
      page,
      size,
      summary: summary.data as AdminUserSummary,
    };
  },
);
