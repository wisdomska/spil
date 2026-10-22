import { requireUser } from "@/lib/api/auth";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { clientIp, readBody, route } from "@/lib/api/handler";
import { requireLivePack } from "@/lib/api/packs";
import { generateCode } from "@/lib/game";
import { rateLimit } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";
import { createRoom } from "@/lib/validation/schemas";

/** POST /rooms: a lobby with no players yet; the creator joins as host next. */
export const POST = route(async (request) => {
  const userId = await requireUser(request);
  const body = await readBody(request, createRoom);
  await rateLimit("roomCreate", userId);
  await verifyTurnstile(body.captchaToken, clientIp(request));
  const pack = await requireLivePack(body.packId);
  const questionCount = body.questionCount
    ? Math.min(body.questionCount, pack.questionCount)
    : null;

  // Insert and retry on the unique live-code index, so two rooms can never share a code.
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateCode();
    const { error } = await getAdminClient().from("rooms").insert({
      code,
      pack_id: pack.id,
      created_by: userId,
      question_count: questionCount,
    });
    if (!error) return { code };
    if (error.code !== "23505") throw fromDbError(error);
  }
  throw new ApiError("INTERNAL", "No free room code. Try again.");
});
