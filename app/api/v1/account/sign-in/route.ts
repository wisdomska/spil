import { signIn } from "@/lib/api/account";
import { clientIp, readBody, route } from "@/lib/api/handler";
import { rateLimit } from "@/lib/ratelimit";
import { getUserId } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";
import { signIn as signInBody } from "@/lib/validation/schemas";

/**
 * POST /account/sign-in: username and password. Bot checked; 10 tries per 15 minutes per username
 * (60 per IP, which many players can share). With mergeGuest, this phone's guest progress moves to the account.
 */
export const POST = route(async (request) => {
  const body = await readBody(request, signInBody);
  const ip = clientIp(request);
  await verifyTurnstile(body.captchaToken, ip, "account", request);
  await rateLimit("accountSignInIp", ip);
  await rateLimit("accountSignIn", `user:${body.username.trim().toLowerCase()}`);
  const current = await getUserId(request);
  return signIn(current, body.username, body.password, body.mergeGuest ?? false);
});
