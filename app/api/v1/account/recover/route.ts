import { recover } from "@/lib/api/account";
import { clientIp, readBody, route } from "@/lib/api/handler";
import { rateLimit } from "@/lib/ratelimit";
import { verifyTurnstile } from "@/lib/turnstile";
import { recoverAccount } from "@/lib/validation/schemas";

/**
 * POST /account/recover: the recovery code sets a new password and signs in; a new code replaces
 * the used one. Bot checked; 5 tries per hour per username (30 per IP).
 */
export const POST = route(async (request) => {
  const body = await readBody(request, recoverAccount);
  const ip = clientIp(request);
  await verifyTurnstile(body.captchaToken, ip, "account", request);
  await rateLimit("accountRecoverIp", ip);
  await rateLimit("accountRecover", `user:${body.username.trim().toLowerCase()}`);
  return recover(body.username, body.recoveryCode, body.password);
});
