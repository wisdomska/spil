import { ApiError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { putGames } from "@/lib/admin/schemas";
import { audit, requireAdmin } from "@/lib/admin/server";
import { invalidateConfig } from "@/lib/flags";
import { MODES } from "@/lib/game";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * PUT /admin/settings/games: which games are switched off for new rooms. Rooms already playing
 * one finish it. At least one game stays on. Owner only.
 */
export const PUT = route(async (request) => {
  const me = await requireAdmin(request, "settings.write");
  const body = await readBody(request, putGames);
  const disabled = [...new Set(body.disabled)];
  if (disabled.length >= MODES.length)
    throw new ApiError("BAD_REQUEST", "Keep at least one game on.");
  const db = getAdminClient();
  const { data: before } = await db.from("settings").select("disabled_modes").maybeSingle();
  const { error } = await db.from("settings").update({ disabled_modes: disabled }).eq("id", true);
  if (error) throw new ApiError("INTERNAL");
  invalidateConfig();
  await audit(
    me,
    "games_changed",
    disabled.length ? `Off: ${disabled.join(", ")}` : "All games on",
    { disabled: before?.disabled_modes ?? [] },
    { disabled },
  );
  return { disabled };
});
