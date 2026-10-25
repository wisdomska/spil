import { requireUser } from "@/lib/api/auth";
import { answerDaily, dailyState } from "@/lib/api/daily";
import { readBody, route } from "@/lib/api/handler";
import { rateLimit } from "@/lib/ratelimit";
import { postDaily } from "@/lib/validation/schemas";

/** GET /daily: today's question, my answer, and the share of yes once enough answered. */
export const GET = route(async (request) => dailyState(await requireUser(request)));

/** POST /daily: answer today's question, once. */
export const POST = route(async (request) => {
  const userId = await requireUser(request);
  const body = await readBody(request, postDaily);
  await rateLimit("write", userId);
  return answerDaily(userId, body.value);
});
