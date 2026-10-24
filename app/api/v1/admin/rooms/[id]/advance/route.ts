import { ApiError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { audit, requireAdmin } from "@/lib/admin/server";
import { forceAdvance, type RoomRow } from "@/lib/api/rooms";
import { getAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /admin/rooms/:id/advance: moves a live room on one phase, as the host's "Move on without
 * them" would (SPIL-01). For rooms stuck in answering, guessing or ready.
 */
export const POST = route<Ctx>(async (request, { params }) => {
  const me = await requireAdmin(request, "rooms.advance");
  const { id } = await params;
  const { data: room } = await getAdminClient()
    .from("rooms")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!room) throw new ApiError("ROOM_NOT_FOUND");
  const from = room.status;
  if (!(await forceAdvance(room as RoomRow))) throw new ApiError("WRONG_PHASE");
  const { data: after } = await getAdminClient()
    .from("rooms")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  await audit(me, "room_advanced", room.code, { status: from }, { status: after?.status ?? from });
  return {};
});
