"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SavePrompt } from "@/components/account/SavePrompt";
import { AgeGate } from "@/components/age/AgeGate";
import { Vessel } from "@/components/brand/Vessel";
import { ErrorScreen } from "@/components/site/ErrorScreen";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { playableBand, useDeviceAge } from "@/lib/age/device";
import type { DailyState } from "@/lib/api/daily";
import { api, ensureSession } from "@/lib/api/client";
import { nextStreak, type Streak } from "@/lib/game";

const STREAK_KEY = "spil:daily-streak";

function readStreak(): Streak | null {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    return raw ? (JSON.parse(raw) as Streak) : null;
  } catch {
    return null;
  }
}

/**
 * Daily Spill (Batch 2): today's question for everyone. Answer once; then see the share of yes
 * once enough people answered. The streak lives on this device only.
 */
export function DailySpill({ ageLockHours }: { ageLockHours: number }) {
  const t = useTranslations("daily");
  const tq = useTranslations("question");
  const tt = useTranslations("toast");
  const toast = useToast();
  const qc = useQueryClient();
  const { band: stored, setAge } = useDeviceAge();
  const band = playableBand(stored);
  const today = useQuery({
    queryKey: ["daily"],
    queryFn: async () => {
      await ensureSession();
      return api<DailyState>("GET", "/daily");
    },
    enabled: Boolean(band),
  });
  // Shown only after today loads in the browser, so reading storage here is safe.
  const [streak, setStreak] = useState<Streak | null>(() =>
    typeof window === "undefined" ? null : readStreak(),
  );
  const [busy, setBusy] = useState(false);

  if (stored === undefined) return <main className="min-h-[60dvh]" aria-busy="true" />;
  if (stored === "under_13") return <ErrorScreen variant="tooYoung" />;
  if (!band) return <AgeGate who="player" onAge={(years) => setAge(years, ageLockHours)} />;
  if (today.error) return <ErrorScreen variant="server" onRetry={() => today.refetch()} />;
  const d = today.data;
  // The server counts from my answers (it follows an account); this phone's own count covers
  // a streak from before a lost session.
  const days = Math.max(d?.streak ?? 0, streak && streak.last === d?.day ? streak.days : 0);

  const answer = async (value: "yes" | "no") => {
    if (busy || !d) return;
    setBusy(true);
    try {
      const next = await api<DailyState>("POST", "/daily", { value });
      qc.setQueryData(["daily"], next);
      const s = nextStreak(readStreak(), next.day);
      try {
        localStorage.setItem(STREAK_KEY, JSON.stringify(s));
      } catch {
        // the streak is a nicety; the answer is saved
      }
      setStreak(s);
    } catch {
      toast(tt("somethingWrong"), "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto box-border flex w-full max-w-[560px] flex-1 flex-col gap-6 px-5 pt-6 pb-10">
      <div className="grid gap-2.5">
        <span className="font-mono text-[13px] leading-none font-medium tracking-[.06em] text-text-muted uppercase">
          {t("kicker")}
        </span>
        <h1 className="m-0 font-display text-display-m leading-[1] font-extrabold tracking-display text-balance">
          {d ? (
            <>
              <span className="mb-2 block text-[20px] leading-none font-semibold text-text-muted">
                {tq("haveYouEver")}
              </span>
              {d.question.text}
            </>
          ) : (
            t("loading")
          )}
        </h1>
      </div>

      {d && !d.mine && (
        <div className="flex gap-2.5">
          <Button
            variant="secondary"
            className="flex-1"
            loading={busy}
            onClick={() => answer("no")}
          >
            {tq("no")}
          </Button>
          <Button className="flex-1" loading={busy} onClick={() => answer("yes")}>
            {tq("yes")}
          </Button>
        </div>
      )}

      {d?.mine && (
        <div className="grid grid-cols-[minmax(0,1fr)_120px] items-end gap-5">
          <div className="grid gap-2">
            <p className="m-0 text-[17px] leading-[1.45] font-semibold">
              {t(d.mine === "yes" ? "youYes" : "youNo")}
            </p>
            <p className="m-0 text-[15px] leading-[1.45] text-text-muted">
              {d.share === null ? t("tooFew") : t("share", { share: d.share, total: d.total })}
            </p>
          </div>
          {d.share !== null && (
            <Vessel level={d.share} num={`${d.share}%`} height={150} fontSize={44} radius={18} />
          )}
        </div>
      )}

      {days > 0 && (
        <p className="m-0 font-mono text-[15px] leading-none font-medium">
          {t("streak", { days })}
        </p>
      )}
      {days >= 3 && <SavePrompt reason="streak" days={days} />}
      <p className="m-0 mt-auto text-[13px] leading-[1.45] text-text-muted">{t("privacy")}</p>
    </main>
  );
}
