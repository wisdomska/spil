import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { route } from "@/lib/api/handler";
import { freshState, requireMember } from "@/lib/api/rooms";
import { getAdminClient } from "@/lib/supabase/admin";

/** POST /rooms/:code/confirm-age: the caller confirms they are 18 or older. We store only the flag. */
export const POST = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const room = await requireMember(code, userId);
  await getAdminClient().from("players").update({ age_confirmed: true }).eq("id", room.me.id);
  return freshState(code, userId);
});
