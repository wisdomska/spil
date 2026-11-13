import "server-only";
import { getAdminClient } from "./supabase/admin";
import { IS_PROD } from "./supabase/env";

export type FlagKey =
  "polling_only" | "adult_packs_enabled" | "test_players" | "payments_enabled" | "party_mode";

export type Settings = {
  questionsPerGame: number;
  maxPlayers: number;
  minPlayers: number;
  /** Hours a minor's age stays locked on their device (SPIL-02). */
  ageLockHours: number;
  /** A short notice shown to every player while on (maintenance, events). */
  notice: string;
  noticeOn: boolean;
  /** Games switched off from the admin console. */
  disabledModes: string[];
};

// Settings and flags change rarely (admin edits); a short in-memory cache saves two queries on
// every request. Admin writes call invalidateConfig() so their own instance updates at once.
const TTL_MS = 15_000;
let settingsCache: { at: number; value: Settings } | null = null;
let flagsCache: { at: number; value: Record<FlagKey, boolean> } | null = null;

export function invalidateConfig() {
  settingsCache = null;
  flagsCache = null;
}

export async function getSettings(): Promise<Settings> {
  if (settingsCache && Date.now() - settingsCache.at < TTL_MS) return settingsCache.value;
  const { data } = await getAdminClient()
    .from("settings")
    .select(
      "questions_per_game, max_players, min_players, age_lock_hours, notice, notice_on, disabled_modes",
    )
    .maybeSingle();
  const value = {
    questionsPerGame: data?.questions_per_game ?? 10,
    maxPlayers: data?.max_players ?? 12,
    minPlayers: data?.min_players ?? 1,
    ageLockHours: data?.age_lock_hours ?? 24,
    notice: data?.notice ?? "",
    noticeOn: data?.notice_on ?? false,
    disabledModes: data?.disabled_modes ?? [],
  };
  settingsCache = { at: Date.now(), value };
  return value;
}

export async function getFlags(): Promise<Record<FlagKey, boolean>> {
  if (flagsCache && Date.now() - flagsCache.at < TTL_MS) return flagsCache.value;
  const { data } = await getAdminClient().from("feature_flags").select("key, enabled");
  const flags: Record<FlagKey, boolean> = {
    polling_only: false,
    adult_packs_enabled: true,
    test_players: false,
    payments_enabled: false,
    party_mode: false,
  };
  for (const row of data ?? []) if (row.key in flags) flags[row.key as FlagKey] = row.enabled;
  // Test players never exist in production, whatever the flag says (spec section 2).
  if (IS_PROD) flags.test_players = false;
  flagsCache = { at: Date.now(), value: flags };
  return flags;
}
