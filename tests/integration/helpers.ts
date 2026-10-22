import { createClient } from "@supabase/supabase-js";

export const BASE = process.env.API_BASE_URL ?? "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const enabled = Boolean(process.env.API_BASE_URL && SUPABASE_URL && ANON);

export type Player = { token: string; userId: string; call: Caller };
// Response bodies are checked field by field in the tests, so they are loosely typed here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Caller = <T = any>(
  method: string,
  path: string,
  body?: unknown,
) => Promise<{ status: number; body: T }>;

/** A fresh anonymous user with a bound API caller (Bearer token, like the real cookie session). */
export async function anonPlayer(): Promise<Player> {
  const supabase = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.session) throw new Error(`anonymous sign-in failed: ${error?.message}`);
  const token = data.session.access_token;
  const call: Caller = async (method, path, body) => {
    const res = await fetch(`${BASE}/api/v1${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : {} };
  };
  return { token, userId: data.user!.id, call };
}

export const code = (r: { body: { error?: { code: string } } }) => r.body.error?.code;
