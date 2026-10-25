import { codeOf, type CodeParams } from "@/lib/api/auth";
import { route } from "@/lib/api/handler";
import { publicRoom } from "@/lib/api/publicRoom";
import { getUserId } from "@/lib/supabase/server";

/** GET /rooms/:code: public preview for the join flow and link previews. No answers, no ids. */
export const GET = route<CodeParams>(async (request, ctx) =>
  publicRoom(await codeOf(ctx), await getUserId(request)),
);
