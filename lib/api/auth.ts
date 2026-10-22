import "server-only";
import { getUserId } from "@/lib/supabase/server";
import { ApiError } from "./errors";

/** The caller's Supabase user id (anonymous or email). Throws UNAUTHENTICATED without a session. */
export async function requireUser(request: Request): Promise<string> {
  const id = await getUserId(request);
  if (!id) throw new ApiError("UNAUTHENTICATED");
  return id;
}

export type CodeParams = { params: Promise<{ code: string }> };

export async function codeOf({ params }: CodeParams) {
  const { code } = await params;
  return code.toUpperCase();
}
