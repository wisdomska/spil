"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

type Options = {
  code: string;
  /** room:{uuid} from RoomState. */
  channel: string | undefined;
  playerId: string | undefined;
  pollingOnly: boolean;
  onNudge?: (targetPlayerId: string) => void;
};

/**
 * One private channel per room (spec section 11). Every event is a signal to refetch /state; the
 * only payload read is nudge.targetPlayerId. If the channel is not SUBSCRIBED within 5 s, drops,
 * or polling_only is on, /state is polled every 5 s instead. Presence gives the online dots.
 */
export function useRoomChannel({ code, channel, playerId, pollingOnly, onNudge }: Options) {
  const qc = useQueryClient();
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [live, setLive] = useState(false);
  const nudgeRef = useRef(onNudge);
  useEffect(() => {
    nudgeRef.current = onNudge;
  }, [onNudge]);

  useEffect(() => {
    if (!channel || !playerId || pollingOnly) return;
    const supabase = getBrowserClient();
    const refetch = () => qc.invalidateQueries({ queryKey: ["room", code] });
    let cancelled = false;
    const ch = supabase.channel(channel, {
      config: { private: true, presence: { key: playerId } },
    });

    ch.on("broadcast", { event: "*" }, ({ event, payload }) => {
      if (event === "nudge" && payload?.targetPlayerId) nudgeRef.current?.(payload.targetPlayerId);
      refetch();
    }).on("presence", { event: "sync" }, () => {
      setOnline(new Set(Object.keys(ch.presenceState())));
    });

    (async () => {
      // Private channels authorise with the user's JWT.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) await supabase.realtime.setAuth(data.session.access_token);
      ch.subscribe(async (status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          setLive(true);
          await ch.track({ at: Date.now() });
          refetch();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setLive(false);
        }
      });
    })();

    return () => {
      cancelled = true;
      setLive(false);
      supabase.removeChannel(ch);
    };
  }, [channel, playerId, pollingOnly, code, qc]);

  return { online, live };
}
