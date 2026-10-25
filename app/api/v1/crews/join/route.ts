import { requireUser } from "@/lib/api/auth";
import { addMember, cleanCrewName, crewByToken } from "@/lib/api/crews";
import { ApiError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { requireMember } from "@/lib/api/rooms";
import { rateLimit } from "@/lib/ratelimit";
import { joinCrewBody } from "@/lib/validation/schemas";

/** POST /crews/join: join a crew by its invite link, or from a room that plays as it. */
export const POST = route(async (request) => {
  const userId = await requireUser(request);
  const body = await readBody(request, joinCrewBody);
  await rateLimit("join", userId);
  if ("token" in body) {
    const crew = await crewByToken(body.token);
    await addMember(crew.id, userId, cleanCrewName(body.nickname));
    return { id: crew.id };
  }
  const room = await requireMember(body.roomCode.toUpperCase(), userId);
  if (!room.room.crew_id) throw new ApiError("NOT_FOUND");
  await addMember(room.room.crew_id, userId, room.me.nickname);
  return { id: room.room.crew_id };
});
