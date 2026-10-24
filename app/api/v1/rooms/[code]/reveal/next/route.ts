import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { freshState, requireHost, requireMember, requirePhase } from "@/lib/api/rooms";
import { checkRevealNext, revealSlides, spillGroups } from "@/lib/game";
import { getAdminClient } from "@/lib/supabase/admin";
import { revealNext } from "@/lib/validation/schemas";

/**
 * POST /rooms/:code/reveal/next: the host moves every phone to the next slide (SPIL-11). The body
 * says which slide the host was on, so a double tap or an old screen moves nothing. Refused
 * before the slide has had its time on screen.
 */
export const POST = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const { expected } = await readBody(request, revealNext);
  const room = await requireMember(code, userId);
  requireHost(room);
  requirePhase(room.room, "revealed");
  const db = getAdminClient();
  const [rows, awards] = await Promise.all([
    db
      .from("results")
      .select("spill_score")
      .eq("room_id", room.room.id)
      .eq("round", room.room.round),
    db
      .from("awards")
      .select("award", { count: "exact", head: true })
      .eq("room_id", room.room.id)
      .eq("round", room.room.round),
  ]);
  if (rows.error) throw fromDbError(rows.error);
  const groups = spillGroups((rows.data ?? []).map((r) => ({ score: r.spill_score }))).length;
  const slides = revealSlides(groups, awards.count ?? 0);
  const startedAt = Date.parse(room.room.reveal_at ?? room.room.revealed_at ?? "");
  const check = checkRevealNext({
    index: room.room.reveal_index,
    expected,
    slides,
    groups,
    elapsedMs: Number.isFinite(startedAt) ? Date.now() - startedAt : Infinity,
  });
  if (check === "too_early") throw new ApiError("TOO_EARLY");
  if (check === "ok") {
    // Only moves on from the expected slide, so two taps can never skip one.
    const { error } = await db
      .from("rooms")
      .update({ reveal_index: expected + 1, reveal_at: new Date().toISOString() })
      .eq("id", room.room.id)
      .eq("reveal_index", expected);
    if (error) throw fromDbError(error);
  }
  return freshState(code, userId);
});
