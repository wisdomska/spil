import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { route } from "@/lib/api/handler";
import { livePacks } from "@/lib/api/packs";
import { requireHost, requireMember, roomFloor } from "@/lib/api/rooms";

/**
 * GET /rooms/:code/packs: the packs the host may switch to, for the youngest player in the room
 * (SPIL-02). `someHidden` lets the picker say "Some packs are hidden for this room." without
 * naming anyone; the hidden packs themselves are never sent.
 */
export const GET = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const room = await requireMember(await codeOf(ctx), userId);
  requireHost(room);
  const [packs, all] = await Promise.all([livePacks(roomFloor(room.players)), livePacks(18)]);
  return { packs, someHidden: packs.length < all.length };
});
