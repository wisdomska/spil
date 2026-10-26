import { ApiError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { pageRange, parsePage, parseSize, type Paged } from "@/lib/admin/paging";
import { requireAdmin } from "@/lib/admin/server";
import type { AuditRow } from "@/lib/admin/types";
import { getAdminClient } from "@/lib/supabase/admin";

/** Characters that would break a PostgREST or() filter are dropped from the search text. */
const clean = (s: string) =>
  s
    .replace(/[,()*%\\]/g, " ")
    .trim()
    .slice(0, 80);

/**
 * GET /admin/audit: every admin action, newest first. With `page` it returns one page
 * `{ rows, total, page, size }`; `q` searches who and target, and `actions` (comma separated
 * action keys whose label matched in the console) widens the match. Without `page`, the last 300.
 */
export const GET = route(async (request): Promise<AuditRow[] | Paged<AuditRow>> => {
  await requireAdmin(request, "audit.read");
  const db = getAdminClient();
  const params = new URL(request.url).searchParams;
  if (!params.has("page")) {
    const { data, error } = await db
      .from("audit_log")
      .select("id, at, who, action, target")
      .order("at", { ascending: false })
      .order("id", { ascending: false })
      .limit(300);
    if (error) throw new ApiError("INTERNAL");
    return data ?? [];
  }
  const page = parsePage(params.get("page"));
  const size = parseSize(params.get("size"), 50);
  const q = clean(params.get("q") ?? "");
  const actions = (params.get("actions") ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter((a) => /^[a-z_.]+$/.test(a))
    .slice(0, 50);
  const { from, to } = pageRange(page, size);
  let query = db.from("audit_log").select("id, at, who, action, target", { count: "exact" });
  if (q) {
    const terms = [`who.ilike.*${q}*`, `target.ilike.*${q}*`, `action.ilike.*${q}*`];
    if (actions.length) terms.push(`action.in.(${actions.join(",")})`);
    query = query.or(terms.join(","));
  }
  const { data, count, error } = await query
    .order("at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);
  if (error) throw new ApiError("INTERNAL");
  return { rows: data ?? [], total: count ?? 0, page, size };
});
