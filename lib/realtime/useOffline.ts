"use client";

import { useEffect, useRef, useState } from "react";

/** A player counts as offline after this long out of the room's presence (SPIL-03). */
export const OFFLINE_AFTER_MS = 10_000;

/**
 * Players missing from presence for more than 10 s. Only meaningful while realtime is live;
 * in polling mode there is no presence, so nobody is shown offline.
 */
export function useOffline(ids: readonly string[], online: Set<string>, live: boolean) {
  const missingSince = useRef(new Map<string, number>());
  const [offline, setOffline] = useState<Set<string>>(NONE);
  const key = ids.join(",");

  useEffect(() => {
    if (!live) {
      missingSince.current.clear();
      return;
    }
    const now = Date.now();
    for (const id of ids) {
      if (online.has(id)) missingSince.current.delete(id);
      else if (!missingSince.current.has(id)) missingSince.current.set(id, now);
    }
    const update = () => {
      const t = Date.now();
      const next = new Set(
        [...missingSince.current].filter(([, at]) => t - at >= OFFLINE_AFTER_MS).map(([id]) => id),
      );
      setOffline((prev) =>
        prev.size === next.size && [...next].every((id) => prev.has(id)) ? prev : next,
      );
    };
    const first = setTimeout(update, 0);
    const timer = setInterval(update, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
    // ids is captured through key so a new array with the same players does not reset timers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, online, live]);

  return live ? offline : NONE;
}

const NONE: Set<string> = new Set();
