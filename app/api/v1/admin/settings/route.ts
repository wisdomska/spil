import { ApiError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { patchSettings } from "@/lib/admin/schemas";
import { audit, requireAdmin } from "@/lib/admin/server";
import type { SettingsPayload } from "@/lib/admin/types";
import { invalidateConfig } from "@/lib/flags";
import { getAdminClient } from "@/lib/supabase/admin";
import { IS_PROD } from "@/lib/supabase/env";

async function read(): Promise<SettingsPayload["settings"]> {
  const { data, error } = await getAdminClient()
    .from("settings")
    .select("questions_per_game, min_players, max_players, age_lock_hours")
    .maybeSingle();
  if (error) throw new ApiError("INTERNAL");
  return {
    questionsPerGame: data?.questions_per_game ?? 10,
    minPlayers: data?.min_players ?? 1,
    maxPlayers: data?.max_players ?? 12,
    ageLockHours: data?.age_lock_hours ?? 24,
  };
}

/** GET /admin/settings: game settings and feature flags (read fresh, not from the cache). */
export const GET = route(async (request): Promise<SettingsPayload> => {
  const me = await requireAdmin(request, "account.self");
  const [settings, flags, extra] = await Promise.all([
    read(),
    getAdminClient().from("feature_flags").select("key, enabled").order("key"),
    getAdminClient().from("settings").select("notice, notice_on, disabled_modes").maybeSingle(),
  ]);
  if (flags.error || extra.error) throw new ApiError("INTERNAL");
  return {
    settings,
    flags: Object.fromEntries((flags.data ?? []).map((f) => [f.key, f.enabled])),
    canResetData: !IS_PROD && me.role === "owner",
    notice: { text: extra.data?.notice ?? "", on: extra.data?.notice_on ?? false },
    disabledModes: extra.data?.disabled_modes ?? [],
  };
});

/** PATCH /admin/settings: questions per game, min and max players, age lock. Owner only. */
export const PATCH = route(async (request) => {
  const me = await requireAdmin(request, "settings.write");
  const body = await readBody(request, patchSettings);
  const before = await read();
  const { error } = await getAdminClient().from("settings").upsert({
    id: true,
    questions_per_game: body.questionsPerGame,
    min_players: body.minPlayers,
    max_players: body.maxPlayers,
    age_lock_hours: body.ageLockHours,
  });
  if (error) throw new ApiError("INTERNAL");
  invalidateConfig();
  await audit(
    me,
    "settings_changed",
    `${body.questionsPerGame} questions, ${body.minPlayers} to ${body.maxPlayers} players, age lock ${body.ageLockHours} h`,
    before,
    body,
  );
  return body;
});
