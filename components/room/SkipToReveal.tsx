"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { RoomState } from "@/lib/api/types";
import { SKIP_TO_REVEAL_MS, canSkipToReveal } from "@/lib/game";

type Props = { state: RoomState; onSkip: () => void; skipping: boolean };

/** Host escape hatch: shows once guessing has run 60 s (SPIL-01). The server checks the same. */
export function SkipToReveal({ state, onSkip, skipping }: Props) {
  const t = useTranslations("waiting");
  const { status, guessingAt } = state.room;
  const [now, setNow] = useState(() => Date.now());
  const ready = canSkipToReveal({ status, guessingAt: guessingAt ?? null }, now);

  useEffect(() => {
    if (ready || status !== "guessing" || !guessingAt) return;
    const wait = Date.parse(guessingAt) + SKIP_TO_REVEAL_MS - Date.now();
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, wait) + 250);
    return () => clearTimeout(timer);
  }, [ready, status, guessingAt, now]);

  if (!state.me.isHost || !ready) return null;
  return (
    <Button variant="secondary" block loading={skipping} onClick={onSkip}>
      {t("skipToReveal")}
    </Button>
  );
}
