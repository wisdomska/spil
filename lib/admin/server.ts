import "server-only";
import { ApiError } from "@/lib/api/errors";
import { getAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import type { AuditAction } from "./audit-actions";
import { can, isRole, type Permission } from "./roles";
import type { Me } from "./types";

/**
 * Signed-in admins this server instance has already looked up, for 30 seconds (owner request
 * 2026-11-13: the console was slow). Every admin request checks the allow-list first, which was
 * a database round trip before the real query on each call. Only positive answers are kept, and
 * any change to the admins table on this instance clears the cache at once; another instance can
 * take up to 30 seconds to notice a removed admin.
 */
const ADMIN_TTL_MS = 30_000;
const adminCache = new Map<string, { at: number; me: Me }>();

export function invalidateAdminCache() {
  adminCache.clear();
}

/** The admins row for a user id, read with the service role (the allow-list is authoritative). */
export async function findAdmin(userId: string): Promise<Me | null> {
  const hit = adminCache.get(userId);
  if (hit && Date.now() - hit.at < ADMIN_TTL_MS) return hit.me;
  const me = await readAdmin(userId);
  if (me) adminCache.set(userId, { at: Date.now(), me });
  else adminCache.delete(userId);
  return me;
}

async function readAdmin(userId: string): Promise<Me | null> {
  const { data, error } = await getAdminClient()
    .from("admins")
    .select("user_id, name, email, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new ApiError("INTERNAL");
  if (!data || !isRole(data.role)) return null;
  return { userId: data.user_id, name: data.name, email: data.email, role: data.role };
}

/**
 * The calling admin. 401 without a session; 403 when the user is not in `admins` or their role
 * lacks the permission. Every /api/v1/admin handler starts here.
 */
export async function requireAdmin(request: Request, permission: Permission): Promise<Me> {
  const userId = await getUserId(request);
  if (!userId) throw new ApiError("UNAUTHENTICATED");
  const admin = await findAdmin(userId);
  if (!admin || !can(admin.role, permission)) throw new ApiError("FORBIDDEN");
  return admin;
}

/** Appends to the audit log. Failures are logged, never shown: the change itself already happened. */
export async function audit(
  actor: Pick<Me, "userId" | "name">,
  action: AuditAction,
  target: string,
  before?: unknown,
  after?: unknown,
) {
  const { error } = await getAdminClient()
    .from("audit_log")
    .insert({
      admin_user_id: actor.userId,
      who: actor.name,
      action,
      target: target.slice(0, 300),
      before: (before ?? null) as Json,
      after: (after ?? null) as Json,
    });
  if (error) console.error("[audit]", action, error.message);
}

/** Reads every row of a query past PostgREST's 1,000 row page. */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  size = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new ApiError("INTERNAL");
    out.push(...(data ?? []));
    if (!data || data.length < size) return out;
  }
}

/** A Postgres foreign key violation (row still referenced, e.g. by a room). */
export const isFkViolation = (error: { code?: string } | null | undefined) =>
  error?.code === "23503";
export const isUniqueViolation = (error: { code?: string } | null | undefined) =>
  error?.code === "23505";
