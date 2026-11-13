import { ApiError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { bulkUserAction } from "@/lib/admin/schemas";
import { requireAdmin } from "@/lib/admin/server";
import { banUser, kickUser, signOutUser, unbanUser } from "@/lib/admin/user-actions";

/**
 * POST /admin/users/bulk: ban, unban, remove from rooms or sign out up to 100 people at once.
 * Each person is handled on their own, so one failure (an admin, a deleted guest) does not stop
 * the rest; the reply says how many worked and how many were skipped.
 */
export const POST = route(async (request) => {
  const me = await requireAdmin(request, "users.act");
  const body = await readBody(request, bulkUserAction);
  let done = 0;
  let skipped = 0;
  for (const id of new Set(body.ids)) {
    try {
      if (body.action === "ban") await banUser(me, id, body);
      else if (body.action === "unban") await unbanUser(me, id);
      else if (body.action === "kick") await kickUser(me, id);
      else await signOutUser(me, id);
      done += 1;
    } catch (e) {
      if (!(e instanceof ApiError) || e.code === "INTERNAL") throw e;
      skipped += 1;
    }
  }
  return { done, skipped };
});
