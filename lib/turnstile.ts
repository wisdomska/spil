import "server-only";
import { ApiError } from "./api/errors";

/**
 * Verifies a Cloudflare Turnstile token. Without a secret configured (local, CI) verification is
 * skipped, so tests run offline; production always has the secret set.
 */
export async function verifyTurnstile(token: string | undefined, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return;
  if (!token) throw new ApiError("CAPTCHA_FAILED", "Complete the bot check.");
  const body = new URLSearchParams({ secret, response: token, remoteip: ip });
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  const data = (await res.json().catch(() => null)) as { success?: boolean } | null;
  if (!data?.success) throw new ApiError("CAPTCHA_FAILED", "The bot check failed. Try again.");
}
