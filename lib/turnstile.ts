import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "./api/errors";
import { browserFamily } from "./browser";

export type CaptchaEndpoint = "create_room" | "contact";
/** Logs a failed check for the admin dashboard. Never blocks or fails the request itself. */
async function logFailure(
  endpoint: CaptchaEndpoint,
  request: Request,
  errorCodes: string[],
  hostname: string | null,
) {
  try {
    await getAdminClient()
      .from("captcha_events")
      .insert({
        endpoint,
        error_codes: errorCodes.slice(0, 10),
        hostname: hostname?.slice(0, 120) ?? null,
        browser: browserFamily(request.headers.get("user-agent")),
      });
  } catch {
    // diagnostics only
  }
}

/**
 * Verifies a Cloudflare Turnstile token. Without a secret configured (local, CI) verification is
 * skipped, so tests run offline; production always has the secret set. Failures are logged
 * (error codes, hostname, browser family; no IP) so the admin can see them (SPIL-05).
 */
export async function verifyTurnstile(
  token: string | undefined,
  ip: string,
  endpoint: CaptchaEndpoint,
  request: Request,
) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return;
  if (!token) {
    await logFailure(endpoint, request, ["missing-input-response"], null);
    throw new ApiError("CAPTCHA_FAILED", "Complete the bot check.");
  }
  const body = new URLSearchParams({ secret, response: token, remoteip: ip });
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  const data = (await res.json().catch(() => null)) as {
    success?: boolean;
    "error-codes"?: string[];
    hostname?: string;
  } | null;
  if (!data?.success) {
    await logFailure(
      endpoint,
      request,
      data?.["error-codes"] ?? ["no-response"],
      data?.hostname ?? null,
    );
    throw new ApiError("CAPTCHA_FAILED", "The bot check failed. Try again.");
  }
}
