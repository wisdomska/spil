import "server-only";
import { after } from "next/server";
import { createTranslator } from "next-intl";
import webpush from "web-push";
import messages from "@/messages/en.json";
import { getAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/seo";
import { eventForTransition, isGone, roomRecipients, TTL, type RoomEvent } from "./rules";

/**
 * Web Push sender (owner request 2026-11-23, modelled on Clink). Needs the VAPID key pair in
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY; without them nothing is sent and the app
 * never offers notifications. Every send happens after the response has gone out (after()), so
 * a tap is never slower because of it.
 */

const t = createTranslator({ locale: "en", messages, namespace: "push" });

let configured: boolean | null = null;
export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || SITE_URL, pub, priv);
  return (configured = true);
}

export type PushPayload = {
  title: string;
  body: string;
  /** Where a tap on the notification opens. */
  url: string;
  /** Same tag replaces the earlier notification instead of stacking another. */
  tag: string;
};

type Sub = { id: string; endpoint: string; p256dh: string; auth: string };

/** Sends to each device; removes the ones the push service says are gone. Returns how many got it. */
export async function deliver(subs: readonly Sub[], payload: PushPayload, ttl: number) {
  if (!pushConfigured() || subs.length === 0) return 0;
  const db = getAdminClient();
  const body = JSON.stringify(payload);
  const gone: string[] = [];
  const ok: string[] = [];
  // A few at a time: a big room or the daily reminder never opens hundreds of sockets at once.
  for (let i = 0; i < subs.length; i += 20) {
    await Promise.all(
      subs.slice(i, i + 20).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
            {
              TTL: ttl,
              urgency: "high",
              topic: payload.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32),
            },
          );
          ok.push(s.id);
        } catch (e) {
          if (isGone((e as { statusCode?: number }).statusCode)) gone.push(s.id);
          else console.error("[push] send failed", (e as Error).message);
        }
      }),
    );
  }
  if (gone.length) await db.from("push_subscriptions").delete().in("id", gone);
  if (ok.length)
    await db
      .from("push_subscriptions")
      .update({ last_ok_at: new Date().toISOString() })
      .in("id", ok);
  return ok.length;
}

/**
 * Tells the players of a room who are not looking at it that the game moved on: it started,
 * everyone answered, the reveal is ready, or the host started a rematch. Runs after the
 * response. Never fails the request that caused it.
 */
export function notifyRoomTransition(
  room: { id: string; code: string },
  from: string,
  to: string,
  exceptUserId?: string | null,
) {
  const event = eventForTransition(from, to);
  if (!event || !pushConfigured()) return;
  const run = () =>
    sendRoomEvent(room, event, exceptUserId).catch((e) => {
      console.error("[push] room event failed", (e as Error).message);
    });
  try {
    after(run);
  } catch {
    // Outside a request (a script or test): send now.
    void run();
  }
}

async function sendRoomEvent(
  room: { id: string; code: string },
  event: RoomEvent,
  exceptUserId?: string | null,
) {
  const db = getAdminClient();
  const { data: players, error } = await db
    .from("players")
    .select("user_id, is_bot, status, last_seen_at")
    .eq("room_id", room.id);
  if (error) throw error;
  const users = roomRecipients(
    (players ?? []).map((p) => ({
      userId: p.user_id,
      isBot: p.is_bot,
      status: p.status,
      lastSeenAt: p.last_seen_at,
    })),
    event,
    Date.now(),
    exceptUserId,
  );
  if (users.length === 0) return;
  const { data: subs, error: subsError } = await db
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", users)
    .eq("game_updates", true);
  if (subsError) throw subsError;
  await deliver(
    subs ?? [],
    {
      title: t("roomTitle", { code: room.code }),
      body: t(event),
      url: `/r/${room.code}`,
      tag: `room-${room.code}`,
    },
    TTL.room,
  );
}

/** The Today's Spill reminder, to every device that wants it whose person has not answered yet. */
export async function sendDailyReminder(day: string, questionText: string) {
  if (!pushConfigured()) return { sent: 0, devices: 0 };
  const db = getAdminClient();
  const [subs, answered] = await Promise.all([
    db.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").eq("daily", true),
    db.from("daily_answers").select("user_id").eq("day", day),
  ]);
  if (subs.error || answered.error) throw subs.error ?? answered.error;
  const done = new Set((answered.data ?? []).map((a) => a.user_id));
  const waiting = (subs.data ?? []).filter((s) => !done.has(s.user_id));
  const sent = await deliver(
    waiting,
    {
      title: t("dailyTitle"),
      body: t("dailyBody", { text: questionText }),
      url: "/daily",
      tag: `daily-${day}`,
    },
    TTL.daily,
  );
  return { sent, devices: waiting.length };
}

/** A test notification to one person's devices (admin Settings). */
export async function sendTest(userId: string) {
  const { data, error } = await getAdminClient()
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error) throw error;
  const sent = await deliver(
    data ?? [],
    { title: t("testTitle"), body: t("testBody"), url: "/admin/settings", tag: "test" },
    TTL.room,
  );
  return { sent, devices: data?.length ?? 0 };
}
