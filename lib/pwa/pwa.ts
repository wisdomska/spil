"use client";

import { api } from "@/lib/api/client";

/**
 * Installed app and push helpers (owner request 2026-11-23, modelled on Clink's lib/pwa.ts).
 * The public push key comes from the server (/api/v1/push/key), which makes its own key pair
 * when none is set in the environment (owner request 2026-11-24).
 */

let publicKey: Promise<string | null> | null = null;
/** The server's public push key, or null when push is unavailable. Fetched once per page. */
function vapidPublicKey(): Promise<string | null> {
  const baked = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (baked) return Promise.resolve(baked);
  publicKey ??= fetch("/api/v1/push/key")
    .then(async (r) =>
      r.status === 200 ? ((await r.json()) as { publicKey: string }).publicKey : null,
    )
    .catch(() => {
      publicKey = null;
      return null;
    });
  return publicKey;
}

/** Opened from the home screen (installed), not in a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export type Platform = "ios" | "android" | "desktop";
export function platform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

export type PushSupport = "ready" | "needs-install" | "unsupported";

/**
 * Whether this browser can get notifications now: iPhones only allow them in the installed app
 * (iOS 16.4 and later), so a Safari tab there "needs-install".
 */
export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const capable =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (platform() === "ios" && !isStandalone()) return "needs-install";
  return capable ? "ready" : "unsupported";
}

export type PushPrefs = { gameUpdates: boolean; daily: boolean };

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function currentSubscription() {
  if (pushSupport() !== "ready") return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/** Asks for permission (only ever from a tap) and saves this device. */
export async function enablePush(
  prefs: Partial<PushPrefs> = {},
): Promise<"granted" | "denied" | "unsupported"> {
  if (pushSupport() !== "ready") return "unsupported";
  const key = await vapidPublicKey();
  if (!key) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(key),
    }));
  const json = sub.toJSON();
  await api("POST", "/push", { endpoint: json.endpoint, keys: json.keys, ...prefs });
  return "granted";
}

/** This device's saved choices, or null when it does not get notifications. */
export async function readPush(): Promise<PushPrefs | null> {
  try {
    const sub = await currentSubscription();
    if (!sub || Notification.permission !== "granted") return null;
    return await api<PushPrefs>("GET", `/push?endpoint=${encodeURIComponent(sub.endpoint)}`);
  } catch {
    return null;
  }
}

export async function updatePush(prefs: Partial<PushPrefs>): Promise<PushPrefs | null> {
  const sub = await currentSubscription();
  if (!sub) return null;
  return api<PushPrefs>("PATCH", "/push", { endpoint: sub.endpoint, ...prefs });
}

/** Stops notifications on this device (both on the server and in the browser). */
export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await api("DELETE", "/push", { endpoint: sub.endpoint }).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
}

/**
 * A device has one subscription; it belongs to whoever uses SPIL on it now. Re-saved on load,
 * so after signing in to an account the notifications follow the account.
 */
export async function claimPush(): Promise<void> {
  try {
    if (Notification.permission !== "granted") return;
    const sub = await currentSubscription();
    if (!sub) return;
    const json = sub.toJSON();
    await api("POST", "/push", { endpoint: json.endpoint, keys: json.keys });
  } catch {
    /* best effort */
  }
}
