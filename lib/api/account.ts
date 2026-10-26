import "server-only";
import {
  hashRecoveryCode,
  newRecoveryCode,
  placeholderEmail,
  recoveryCodeMatches,
} from "@/lib/account/server";
import { passwordProblem, usernameProblem } from "@/lib/account/rules";
import { getAdminClient } from "@/lib/supabase/admin";
import { getServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/ratelimit";
import { ApiError, fromDbError } from "./errors";

/**
 * Optional accounts (owner decision 2026-10-26). An account is the player's own anonymous user,
 * upgraded in place: same id, so every badge, crew and daily answer stays. Sign-in goes through
 * these functions only (rate limited and bot checked by the routes), never the auth API directly.
 */

const db = () => getAdminClient();

/** Same answer for an unknown username and a wrong password. */
const badCredentials = () =>
  new ApiError("INVALID_CREDENTIALS", "That username and password do not match.");

export type Account = { username: string };

export async function accountOf(userId: string): Promise<Account | null> {
  const { data, error } = await db()
    .from("profiles")
    .select("username")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw fromDbError(error);
  return data ? { username: data.username } : null;
}

async function isGuest(userId: string) {
  const { data, error } = await db().auth.admin.getUserById(userId);
  if (error || !data.user) throw new ApiError("UNAUTHENTICATED");
  return data.user.is_anonymous === true;
}

async function profileByUsername(username: string) {
  const { data, error } = await db()
    .from("profiles")
    .select("user_id, username, recovery_hash")
    .ilike("username", username.trim().replace(/[\\%_]/g, "\\$&"))
    .maybeSingle();
  if (error) throw fromDbError(error);
  return data;
}

function checkPassword(password: string, username: string) {
  const problem = passwordProblem(password, username);
  if (problem) throw new ApiError("PASSWORD_WEAK", PASSWORD_MESSAGES[problem]);
}

const PASSWORD_MESSAGES = {
  short: "Passwords need 10 or more characters.",
  common: "That password is too easy to guess. Try a few words together.",
  username: "Keep your username out of your password.",
} as const;

/**
 * Save your progress: the guest on this phone gets a username and password. Returns the
 * recovery code, which is shown once and stored only as a hash.
 */
export async function createAccount(userId: string, username: string, password: string) {
  const name = username.trim();
  if (usernameProblem(name)) throw new ApiError("USERNAME_INVALID");
  checkPassword(password, name);
  if (!(await isGuest(userId)) || (await accountOf(userId))) throw new ApiError("ACCOUNT_EXISTS");
  await rateLimit("accountCreate", userId);

  const recoveryCode = newRecoveryCode();
  // The profile row reserves the username first; the unique index settles a race.
  const { error } = await db()
    .from("profiles")
    .insert({
      user_id: userId,
      username: name,
      recovery_hash: await hashRecoveryCode(recoveryCode),
    });
  if (error?.code === "23505") throw new ApiError("USERNAME_TAKEN");
  if (error) throw fromDbError(error);

  const { error: authError } = await db().auth.admin.updateUserById(userId, {
    email: placeholderEmail(userId),
    password,
    email_confirm: true,
  });
  if (authError) {
    await db().from("profiles").delete().eq("user_id", userId);
    throw new ApiError("INTERNAL", authError.message);
  }
  // Setting a password ends the user's sessions, this phone's included: start a fresh one.
  await startSession(userId, password);
  return { account: { username: name }, recoveryCode };
}

/** Signs in on the server, so @supabase/ssr sets this phone's session cookie. */
async function startSession(userId: string, password: string) {
  const supabase = await getServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: placeholderEmail(userId),
    password,
  });
  if (error || data.user?.id !== userId) return false;
  return true;
}

/** True when this phone's guest has anything worth adding to an account. */
export async function guestHasProgress(userId: string) {
  const [stats, crews, daily] = await Promise.all([
    db()
      .from("player_stats")
      .select("games", { count: "exact", head: true })
      .eq("user_id", userId)
      .gt("games", 0),
    db()
      .from("crew_members")
      .select("crew_id", { count: "exact", head: true })
      .eq("user_id", userId),
    db().from("daily_answers").select("day", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  return (stats.count ?? 0) + (crews.count ?? 0) + (daily.count ?? 0) > 0;
}

/**
 * Signs in on the server so @supabase/ssr sets the session cookie. A wrong username and a wrong
 * password get the same answer. With `mergeGuest`, the guest that was signed in on this phone
 * (proved by its own session cookie on this request) hands its progress to the account.
 */
export async function signIn(
  currentUserId: string | null,
  username: string,
  password: string,
  mergeGuest: boolean,
) {
  const profile = await profileByUsername(username);
  if (!profile) throw badCredentials();
  const guest =
    currentUserId && currentUserId !== profile.user_id && (await isGuest(currentUserId))
      ? currentUserId
      : null;

  if (!(await startSession(profile.user_id, password))) throw badCredentials();

  if (mergeGuest && guest) {
    const { error: mergeError } = await db().rpc("merge_guest_progress", {
      p_from: guest,
      p_into: profile.user_id,
    });
    if (mergeError) throw fromDbError(mergeError);
  }
  return { account: { username: profile.username }, merged: Boolean(mergeGuest && guest) };
}

/** Forgot the password: the recovery code sets a new one, and a new code replaces the old. */
export async function recover(username: string, code: string, password: string) {
  const profile = await profileByUsername(username);
  if (!profile || !(await recoveryCodeMatches(code, profile.recovery_hash))) throw badCredentials();
  checkPassword(password, profile.username);

  const { error } = await db().auth.admin.updateUserById(profile.user_id, { password });
  if (error) throw new ApiError("INTERNAL", error.message);
  const recoveryCode = newRecoveryCode();
  const { error: saveError } = await db()
    .from("profiles")
    .update({ recovery_hash: await hashRecoveryCode(recoveryCode) })
    .eq("user_id", profile.user_id);
  if (saveError) throw fromDbError(saveError);

  if (!(await startSession(profile.user_id, password)))
    throw new ApiError("INTERNAL", "Could not sign in after the reset.");
  return { account: { username: profile.username }, recoveryCode };
}

export async function signOut() {
  const supabase = await getServerClient();
  await supabase.auth.signOut({ scope: "local" });
}

/** Deletes the account and its data; crews the player started pass to the next member. */
export async function deleteAccount(userId: string, confirmUsername: string) {
  const account = await accountOf(userId);
  if (!account) throw new ApiError("NO_ACCOUNT");
  if (account.username.toLowerCase() !== confirmUsername.trim().toLowerCase())
    throw new ApiError("BAD_REQUEST", "Type your username to confirm.");
  const { error } = await db().rpc("delete_account_data", { p_user: userId });
  if (error) throw fromDbError(error);
  const { error: authError } = await db().auth.admin.deleteUser(userId);
  if (authError) throw new ApiError("INTERNAL", authError.message);
  await signOut();
}
