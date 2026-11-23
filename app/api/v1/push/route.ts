import { z } from "zod";
import { requireUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { rateLimit } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * This device's notifications (owner request 2026-11-23). One row per device (endpoint); it
 * belongs to whoever is signed in on it now, so signing in to an account moves it there.
 */
const endpoint = z.string().url().max(1000);
const prefs = { gameUpdates: z.boolean().optional(), daily: z.boolean().optional() };
const subscribe = z.object({
  endpoint,
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
  ...prefs,
});
const patch = z.object({ endpoint, ...prefs });
const remove = z.object({ endpoint });

const toPrefs = (r: { game_updates: boolean; daily: boolean }) => ({
  gameUpdates: r.game_updates,
  daily: r.daily,
});

/** GET /push?endpoint=: this device's choices, or 404 when it is not subscribed. */
export const GET = route(async (request) => {
  const userId = await requireUser(request);
  const parsed = endpoint.safeParse(new URL(request.url).searchParams.get("endpoint"));
  if (!parsed.success) throw new ApiError("BAD_REQUEST");
  const { data } = await getAdminClient()
    .from("push_subscriptions")
    .select("game_updates, daily")
    .eq("endpoint", parsed.data)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new ApiError("NOT_FOUND");
  return toPrefs(data);
});

/** POST /push: save (or move to this person) this device's subscription. */
export const POST = route(async (request) => {
  const userId = await requireUser(request);
  await rateLimit("write", userId);
  const body = await readBody(request, subscribe);
  const { data, error } = await getAdminClient()
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        ua: request.headers.get("user-agent")?.slice(0, 200) ?? null,
        ...(body.gameUpdates === undefined ? {} : { game_updates: body.gameUpdates }),
        ...(body.daily === undefined ? {} : { daily: body.daily }),
      },
      { onConflict: "endpoint" },
    )
    .select("game_updates, daily")
    .single();
  if (error) throw new ApiError("INTERNAL");
  return toPrefs(data);
});

/** PATCH /push: game updates and the daily reminder on or off for this device. */
export const PATCH = route(async (request) => {
  const userId = await requireUser(request);
  const body = await readBody(request, patch);
  const { data, error } = await getAdminClient()
    .from("push_subscriptions")
    .update({
      ...(body.gameUpdates === undefined ? {} : { game_updates: body.gameUpdates }),
      ...(body.daily === undefined ? {} : { daily: body.daily }),
    })
    .eq("endpoint", body.endpoint)
    .eq("user_id", userId)
    .select("game_updates, daily")
    .maybeSingle();
  if (error) throw new ApiError("INTERNAL");
  if (!data) throw new ApiError("NOT_FOUND");
  return toPrefs(data);
});

/** DELETE /push: stop sending to this device. */
export const DELETE = route(async (request) => {
  const userId = await requireUser(request);
  const body = await readBody(request, remove);
  await getAdminClient()
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", body.endpoint)
    .eq("user_id", userId);
  return {};
});
