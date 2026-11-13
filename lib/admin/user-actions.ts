import "server-only";
import { usernameProblem } from "@/lib/account/rules";
import { invalidateBans } from "@/lib/api/bans";
import { ApiError } from "@/lib/api/errors";
import { getAdminClient } from "@/lib/supabase/admin";
import { nickname as nicknameSchema } from "@/lib/validation/schemas";
import { removeFromLiveRooms } from "./players";
import { audit } from "./server";
import type { Me } from "./types";
import { banEnds } from "./users";

/** The name an admin sees in the audit log for this person. */
async function nameOf(userId: string): Promise<string | null> {
  const { data } = await getAdminClient().rpc("admin_user_detail", { p_user: userId });
  const detail = data as { username: string | null } | null;
  if (!detail) return null;
  return detail.username ?? userId.slice(0, 8);
}

/** Admins are never banned, signed out or deleted from the Users screen. */
async function refuseAdmins(userId: string) {
  const { data } = await getAdminClient()
    .from("admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) throw new ApiError("FORBIDDEN", "Admins are managed in Settings.");
}

export async function banUser(
  me: Me,
  userId: string,
  opts: { reason: string; days: 1 | 7 | 30 | null },
) {
  await refuseAdmins(userId);
  const name = await nameOf(userId);
  if (!name) throw new ApiError("NOT_FOUND");
  const until = banEnds(opts.days, new Date());
  const { error } = await getAdminClient().from("user_bans").upsert({
    user_id: userId,
    reason: opts.reason,
    banned_by: me.userId,
    banned_by_name: me.name,
    created_at: new Date().toISOString(),
    expires_at: until,
  });
  if (error) throw new ApiError("INTERNAL");
  invalidateBans();
  // A ban takes them out of any game they are in right now.
  await removeFromLiveRooms(userId);
  await audit(me, "user_banned", name, null, { reason: opts.reason, until });
}

export async function unbanUser(me: Me, userId: string) {
  const name = (await nameOf(userId)) ?? userId.slice(0, 8);
  const { error } = await getAdminClient().from("user_bans").delete().eq("user_id", userId);
  if (error) throw new ApiError("INTERNAL");
  invalidateBans();
  await audit(me, "user_unbanned", name);
}

export async function kickUser(me: Me, userId: string) {
  const name = await nameOf(userId);
  if (!name) throw new ApiError("NOT_FOUND");
  const rooms = await removeFromLiveRooms(userId);
  await audit(me, "user_kicked", name, null, { rooms });
  return rooms;
}

export async function signOutUser(me: Me, userId: string) {
  await refuseAdmins(userId);
  const name = await nameOf(userId);
  if (!name) throw new ApiError("NOT_FOUND");
  const { data, error } = await getAdminClient().rpc("admin_revoke_sessions", { p_user: userId });
  if (error) throw new ApiError("INTERNAL");
  await audit(me, "user_signed_out", name, null, { sessions: data });
}

/**
 * Accounts get a new username (the same rules as signing up); guests get a new nickname in the
 * rooms they are still in. Old finished rooms keep the name they played under.
 */
export async function renameUser(me: Me, userId: string, raw: string) {
  const db = getAdminClient();
  const before = await nameOf(userId);
  if (!before) throw new ApiError("NOT_FOUND");
  const { data: profile } = await db
    .from("profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (profile) {
    const username = raw.trim();
    if (usernameProblem(username)) throw new ApiError("USERNAME_INVALID");
    const { error } = await db.from("profiles").update({ username }).eq("user_id", userId);
    if (error?.code === "23505") throw new ApiError("USERNAME_TAKEN");
    if (error) throw new ApiError("INTERNAL");
    await audit(me, "user_renamed", before, { name: before }, { name: username });
    return;
  }
  const parsed = nicknameSchema.safeParse(raw);
  if (!parsed.success) throw new ApiError("NAME_INVALID");
  const { data: live, error } = await db
    .from("players")
    .select("id, rooms!players_room_id_fkey!inner(status)")
    .eq("user_id", userId)
    .neq("rooms.status", "closed");
  if (error) throw new ApiError("INTERNAL");
  const ids = (live ?? []).map((p) => p.id);
  if (ids.length) {
    const { error: e } = await db.from("players").update({ nickname: parsed.data }).in("id", ids);
    if (e?.code === "23505") throw new ApiError("NAME_TAKEN");
    if (e) throw new ApiError("INTERNAL");
  }
  await audit(
    me,
    "user_renamed",
    before,
    { name: before },
    { name: parsed.data, rooms: ids.length },
  );
}

/**
 * Deletes a person and what they made, the same way a player deletes their own account. The
 * admin types the person's name to confirm. Owners only (checked by the route).
 */
export async function deleteUser(me: Me, userId: string, confirm: string) {
  await refuseAdmins(userId);
  const name = await nameOf(userId);
  if (!name) throw new ApiError("NOT_FOUND");
  if (confirm.trim().toLowerCase() !== name.toLowerCase())
    throw new ApiError("BAD_REQUEST", "Type the name to confirm.");
  const db = getAdminClient();
  await removeFromLiveRooms(userId);
  const { error } = await db.rpc("delete_account_data", { p_user: userId });
  if (error) throw new ApiError("INTERNAL");
  const { error: authError } = await db.auth.admin.deleteUser(userId);
  if (authError) throw new ApiError("INTERNAL");
  invalidateBans();
  await audit(me, "user_deleted", name);
}
