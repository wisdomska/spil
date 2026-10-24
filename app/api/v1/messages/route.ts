import { fromDbError } from "@/lib/api/errors";
import { clientIp, readBody, route } from "@/lib/api/handler";
import { rateLimit } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";
import { message } from "@/lib/validation/schemas";

/** POST /messages: the contact form. Lands in the admin Inbox. 5 per hour per IP. */
export const POST = route(async (request) => {
  const body = await readBody(request, message);
  const ip = clientIp(request);
  await rateLimit("message", ip);
  await verifyTurnstile(body.captchaToken, ip, "contact", request);
  const { error } = await getAdminClient()
    .from("messages")
    .insert({ name: body.name || null, email: body.email || null, body: body.body });
  if (error) throw fromDbError(error);
  return {};
});
