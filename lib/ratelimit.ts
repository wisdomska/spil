import "server-only";
import { ApiError } from "./api/errors";
import { getAdminClient } from "./supabase/admin";

/** Limits from docs/TECH_SPEC.md section 18. */
export const LIMITS = {
  roomCreate: { limit: 10, window: "1 hour" },
  join: { limit: 30, window: "1 hour" },
  answers: { limit: 300, window: "1 minute" },
  guesses: { limit: 300, window: "1 minute" },
  nudge: { limit: 1, window: "1 minute" },
  report: { limit: 10, window: "1 hour" },
  message: { limit: 5, window: "1 hour" },
  adminLogin: { limit: 5, window: "15 minutes" },
  write: { limit: 120, window: "1 minute" },
} as const;

export type LimitName = keyof typeof LIMITS;

/** Counts a hit and throws RATE_LIMITED when the key is over its window limit. */
export async function rateLimit(name: LimitName, key: string) {
  const { limit, window } = LIMITS[name];
  const { data, error } = await getAdminClient().rpc("check_rate_limit", {
    p_key: `${name}:${key}`,
    p_limit: limit,
    p_window: window,
  });
  if (error) {
    // Fail open: a broken counter must not stop a party. It is logged for follow-up.
    console.error("[ratelimit]", name, error.message);
    return;
  }
  if (data === false) throw new ApiError("RATE_LIMITED");
}
