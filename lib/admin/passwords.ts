import "server-only";
import { randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/** True when the password signs in for that email. Uses a throwaway client and ends its session. */
export async function passwordMatches(email: string, password: string): Promise<boolean> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) return false;
  await client.auth.signOut({ scope: "local" });
  return true;
}

// No look-alike characters (0/O, 1/l/I), so a password read aloud or copied by hand survives.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A temporary password for a new admin or an owner-initiated reset. */
export function temporaryPassword(length = 16): string {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}
