import { requireUser } from "@/lib/api/auth";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { clientIp, readBody, route } from "@/lib/api/handler";
import { requireLivePack } from "@/lib/api/packs";
import { bandFloor, generateCode } from "@/lib/game";
import { rateLimit } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";
import { createRoom } from "@/lib/validation/schemas";

/**
 * POST /rooms: a lobby with no players yet; the creator joins as host next. The pack must suit
 * the host's age band, and the room keeps the pack's minimum age.
 */
export const POST = route(async (request) => {
  const userId = await requireUser(request);
  const body = await readBody(request, createRoom);
  // SPIL-02: the host's band only; the exact age never leaves their device.
  if (body.ageBand === "under_13") throw new ApiError("AGE_TOO_YOUNG");
  const floor = bandFloor(body.ageBand);
  await rateLimit("roomCreate", userId);
  await verifyTurnstile(body.captchaToken, clientIp(request), "create_room", request);
  const pack = await requireLivePack(body.packId, floor);
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
      min_age: pack.minAge,
    });
    if (!error) return { code };
    if (error.code !== "23505") throw fromDbError(error);
  }
  throw new ApiError("INTERNAL", "No free room code. Try again.");
});
