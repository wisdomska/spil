import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { route } from "@/lib/api/handler";
import { livePacks } from "@/lib/api/packs";
import { requireHost, requireMember, roomFloor, roomMode } from "@/lib/api/rooms";
import { modeFormat } from "@/lib/game";

/**
 * GET /rooms/:code/packs: the packs the host may switch to, for the youngest player in the room
 * (SPIL-02). `someHidden` lets the picker say "Some packs are hidden for this room." without
 * naming anyone; the hidden packs themselves are never sent. With `?all=1` it lists every format,
 * so the lobby's game step can see which games have one pack and which several.
 */
export const GET = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const room = await requireMember(await codeOf(ctx), userId);
  requireHost(room);
  // Only packs this room's game can play, unless every format was asked for.
  const everyFormat = new URL(request.url).searchParams.get("all") === "1";
  const format = modeFormat(roomMode(room.room));
  const [packs, all] = (await Promise.all([livePacks(roomFloor(room.players)), livePacks(18)])).map(
    (list) => (everyFormat ? list : list.filter((p) => p.format === format)),
  );
  return { packs: packs!, someHidden: packs!.length < all!.length };
});
