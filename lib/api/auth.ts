import "server-only";
import { getUserId } from "@/lib/supabase/server";
import { isBanned } from "./bans";
import { ApiError } from "./errors";

/**
 * The caller's Supabase user id (anonymous or email). Throws UNAUTHENTICATED without a session
 * and BANNED when an admin has banned them.
 */
export async function requireUser(request: Request): Promise<string> {
  const id = await getUserId(request);
  if (!id) throw new ApiError("UNAUTHENTICATED");
  if (await isBanned(id)) throw new ApiError("BANNED");
  return id;
}

export type CodeParams = { params: Promise<{ code: string }> };

export async function codeOf({ params }: CodeParams) {
  const { code } = await params;
  return code.toUpperCase();
}
