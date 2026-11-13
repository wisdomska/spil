import { ApiError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { pageRange, parsePage, parseSize, type Paged } from "@/lib/admin/paging";
import { requireAdmin } from "@/lib/admin/server";
import type { AdminUser, AdminUserSummary } from "@/lib/admin/types";
import { parseUserSort, usersToCsv } from "@/lib/admin/users";
import { getAdminClient } from "@/lib/supabase/admin";

const FILTERS = ["all", "accounts", "guests", "new", "active", "banned"] as const;

/**
 * GET /admin/users: accounts and guests who played, newest first, one page at a time
 * `{ rows, total, page, size, summary }`. `filter` is all, accounts, guests, new (joined in the
 * last 7 days), active (seen in the last 7 days) or banned; `q` searches usernames and guest
 * names; `sort` is one of USER_SORTS. `format=csv` returns every match (up to 5,000) as a file.
 * Never an email address.
 */
export const GET = route(
  async (request): Promise<(Paged<AdminUser> & { summary: AdminUserSummary }) | Response> => {
    await requireAdmin(request, "users.read");
    const params = new URL(request.url).searchParams;
    const page = parsePage(params.get("page"));
    const size = parseSize(params.get("size"));
    const raw = params.get("filter");
    const filter = (FILTERS as readonly string[]).includes(raw ?? "") ? raw! : "all";
    const q = (params.get("q") ?? "").trim().slice(0, 40);
    const sort = parseUserSort(params.get("sort"));
    const { from } = pageRange(page, size);

    const db = getAdminClient();
    if (params.get("format") === "csv") {
      const all = await db.rpc("admin_accounts", {
        p_query: q,
        p_filter: filter,
        p_limit: 5000,
        p_offset: 0,
        p_sort: sort,
      });
      if (all.error) throw new ApiError("INTERNAL");
      return new Response(usersToCsv((all.data as { rows: AdminUser[] }).rows), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="spil-users.csv"`,
          "cache-control": "no-store",
        },
      });
    }
    const [list, summary] = await Promise.all([
      db.rpc("admin_accounts", {
        p_query: q,
        p_filter: filter,
        p_limit: size,
        p_offset: from,
        p_sort: sort,
      }),
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
