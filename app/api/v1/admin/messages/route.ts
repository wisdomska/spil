import { ApiError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { pageRange, parsePage, parseSize, type Paged } from "@/lib/admin/paging";
import { requireAdmin } from "@/lib/admin/server";
import type { AdminMessage } from "@/lib/admin/types";
import { getAdminClient } from "@/lib/supabase/admin";

const SELECT = "id, name, email, body, status, created_at";
type Row = {
  id: string;
  name: string | null;
  email: string | null;
  body: string;
  status: AdminMessage["status"];
  created_at: string;
};
const toMessage = (m: Row): AdminMessage => ({
  id: m.id,
  name: m.name,
  email: m.email,
  body: m.body,
  status: m.status,
  createdAt: m.created_at,
});

/**
 * GET /admin/messages: the contact form inbox, newest first. With `page` it returns one page
 * `{ rows, total, page, size }` filtered by `status` (all = not archived, new, archived);
 * without it, the newest 500 as a list.
 */
export const GET = route(async (request): Promise<AdminMessage[] | Paged<AdminMessage>> => {
  await requireAdmin(request, "inbox.read");
  const db = getAdminClient();
  const params = new URL(request.url).searchParams;
  if (!params.has("page")) {
    const { data, error } = await db
      .from("messages")
      .select(SELECT)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new ApiError("INTERNAL");
    return ((data ?? []) as Row[]).map(toMessage);
  }
  const page = parsePage(params.get("page"));
  const size = parseSize(params.get("size"));
  const status = params.get("status") ?? "all";
  const { from, to } = pageRange(page, size);
  let query = db.from("messages").select(SELECT, { count: "exact" });
  query =
    status === "new"
      ? query.eq("status", "new")
      : status === "archived"
        ? query.eq("status", "archived")
        : query.neq("status", "archived");
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, to);
  if (error) throw new ApiError("INTERNAL");
  return { rows: ((data ?? []) as Row[]).map(toMessage), total: count ?? 0, page, size };
});
