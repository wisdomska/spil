import { randomBytes } from "node:crypto";
import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { requireHost, requireMember, tvState } from "@/lib/api/rooms";
import { getFlags } from "@/lib/flags";
import { rateLimit } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * POST /rooms/:code/tv: the host pairs a big screen (Party Mode). Returns the room's secret
 * screen token, making one the first time.
 */
export const POST = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const room = await requireMember(code, userId);
  requireHost(room);
  if (!(await getFlags()).party_mode) throw new ApiError("FEATURE_OFF");
  if (room.room.tv_token) return { token: room.room.tv_token };
  const token = randomBytes(24).toString("base64url");
  const { error } = await getAdminClient()
    .from("rooms")
    .update({ tv_token: token })
    .eq("id", room.room.id);
  if (error) throw fromDbError(error);
  return { token };
});

/** GET /rooms/:code/tv?t=: what the paired screen shows. No account; the token is the key. */
export const GET = route<CodeParams>(async (request, ctx) => {
  const code = await codeOf(ctx);
  const token = new URL(request.url).searchParams.get("t") ?? "";
  if (token.length < 24) throw new ApiError("TV_NOT_PAIRED");
  await rateLimit("tv", token.slice(0, 16));
  return tvState(code, token);
});
