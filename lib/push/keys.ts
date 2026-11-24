import "server-only";
import webpush from "web-push";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * The Web Push (VAPID) key pair (owner request 2026-11-24). Environment variables win when set
 * (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY). Otherwise the server makes a pair the first
 * time it is needed and keeps it in app_secrets (server only), so push works with nothing to set
 * up in Vercel. Every server instance reads the same pair, and the first one to save wins.
 */
export type VapidKeys = { publicKey: string; privateKey: string };

const PUBLIC = "vapid_public_key";
const PRIVATE = "vapid_private_key";
let cached: Promise<VapidKeys | null> | null = null;

async function load(): Promise<VapidKeys | null> {
  const envPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const envPrivate = process.env.VAPID_PRIVATE_KEY;
  if (envPublic && envPrivate) return { publicKey: envPublic, privateKey: envPrivate };

  const db = getAdminClient();
  const read = async () => {
    const { data, error } = await db
      .from("app_secrets")
      .select("key, value")
      .in("key", [PUBLIC, PRIVATE]);
    if (error) throw error;
    const map = new Map((data ?? []).map((r) => [r.key, r.value]));
    const publicKey = map.get(PUBLIC);
    const privateKey = map.get(PRIVATE);
    return publicKey && privateKey ? { publicKey, privateKey } : null;
  };
  const existing = await read();
  if (existing) return existing;
  // None yet: make a pair. Both rows go in one insert, and a second instance racing us is
  // ignored (on conflict do nothing), so everyone ends up reading the same pair.
  const fresh = webpush.generateVAPIDKeys();
  const { error } = await db.from("app_secrets").upsert(
    [
      { key: PUBLIC, value: fresh.publicKey },
      { key: PRIVATE, value: fresh.privateKey },
    ],
    { onConflict: "key", ignoreDuplicates: true },
  );
  if (error) throw error;
  return read();
}

/** The key pair, or null when it cannot be read (push then stays off). Cached per instance. */
export function vapidKeys(): Promise<VapidKeys | null> {
  cached ??= load().catch((e) => {
    console.error("[push] keys unavailable", (e as Error).message);
    cached = null;
    return null;
  });
  return cached;
}
