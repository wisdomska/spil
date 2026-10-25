import { requireUser } from "@/lib/api/auth";
import { setCosmetics } from "@/lib/api/achievements";
import { readBody, route } from "@/lib/api/handler";
import { rateLimit } from "@/lib/ratelimit";
import { patchCosmetics } from "@/lib/validation/schemas";

/** PATCH /me/cosmetics: wear an unlocked frame or use an unlocked card look. */
export const PATCH = route(async (request) => {
  const userId = await requireUser(request);
  const body = await readBody(request, patchCosmetics);
  await rateLimit("write", userId);
  return setCosmetics(userId, body);
});
