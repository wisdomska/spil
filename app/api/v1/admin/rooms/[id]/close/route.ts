import { ApiError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { audit, requireAdmin } from "@/lib/admin/server";
import { getAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

/** POST /admin/rooms/:id/close: ends a room. Players are sent back to the start screen. */
export const POST = route<Ctx>(async (request, { params }) => {
  const me = await requireAdmin(request, "rooms.close");
  const { id } = await params;
  const db = getAdminClient();
  const { data: room } = await db
    .from("rooms")
    .select("id, code, status")
    .eq("id", id)
    .maybeSingle();
  if (!room) throw new ApiError("ROOM_NOT_FOUND");
  if (room.status === "closed") return {};
  const { error } = await db.from("rooms").update({ status: "closed" }).eq("id", id);
  if (error) throw new ApiError("INTERNAL");
  await audit(me, "room_closed", room.code, { status: room.status }, { status: "closed" });
  return {};
});
