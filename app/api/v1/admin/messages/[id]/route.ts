import { ApiError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { patchMessage } from "@/lib/admin/schemas";
import { audit, requireAdmin } from "@/lib/admin/server";
import { getAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /admin/messages/:id: mark read (or new again) and archive. */
export const PATCH = route<Ctx>(async (request, { params }) => {
  const me = await requireAdmin(request, "inbox.act");
  const { id } = await params;
  const { status } = await readBody(request, patchMessage);
  const db = getAdminClient();
  const { data: before } = await db
    .from("messages")
    .select("id, email, status")
    .eq("id", id)
    .maybeSingle();
  if (!before) throw new ApiError("NOT_FOUND", "No message with that id.");
  if (before.status === status) return {};
  const { error } = await db.from("messages").update({ status }).eq("id", id);
  if (error) throw new ApiError("INTERNAL");
  await audit(
    me,
    "message_status",
    before.email ?? "anonymous",
    { status: before.status },
    {
      status,
    },
  );
  return {};
});
