import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * Request-scoped client acting as the signed-in user (anon key + session cookie, or a Bearer
 * token for tests). RLS applies.
 */
export async function getServerClient(request?: Request) {
  const bearer = request?.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (bearer) {
    return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  const store = await cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component: the proxy refreshes the session instead.
        }
      },
    },
  });
}

/**
 * The caller's user id. getClaims verifies the JWT signature locally against the project's
 * ES256 public keys (cached JWKS), so no round trip to the auth server per request.
 */
export async function getUserId(request?: Request): Promise<string | null> {
  const supabase = await getServerClient(request);
  const bearer = request?.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  const { data, error } = await supabase.auth.getClaims(bearer);
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub;
}
