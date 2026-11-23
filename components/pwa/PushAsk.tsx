"use client";

import { BellRingingIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { track } from "@/lib/analytics/posthog";
import { enablePush, pushSupport } from "@/lib/pwa/pwa";

const KEY = "spil.pushAsk.until";
const LATER_MS = 7 * 24 * 3600 * 1000;

const noop = () => () => {};
function canAsk(): boolean {
  try {
    if (pushSupport() !== "ready" || Notification.permission !== "default") return false;
    return Number(localStorage.getItem(KEY) ?? 0) < Date.now();
  } catch {
    return false;
  }
}

/**
 * The earned ask for notifications (owner request 2026-11-23, like Clink's push-ask): shown at
 * the moment they would help (waiting on the room, after answering Today's Spill), only when
 * this browser can get them and has not been asked. "Not now" waits a week. Never on its own:
 * the browser's permission prompt only ever follows a tap here.
 */
export function PushAsk({ moment }: { moment: "waiting" | "daily" }) {
  const t = useTranslations("pwa");
  const toast = useToast();
  // Read once on the client; the server renders nothing.
  const allowed = useSyncExternalStore(noop, canAsk, () => false);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!allowed || hidden) return null;

  const later = () => {
    try {
      localStorage.setItem(KEY, String(Date.now() + LATER_MS));
    } catch {}
    setHidden(true);
  };
  const yes = async () => {
    setBusy(true);
    try {
      const result = await enablePush(moment === "daily" ? { daily: true } : {});
      if (result === "granted") track("push_enabled", { from: moment });
      setHidden(true);
    } catch {
      toast(t("notifyFailed"), "err");
    } finally {
      setBusy(false);
    }
  };

  const title = moment === "daily" ? t("askDailyTitle") : t("askWaitingTitle");
  const body = moment === "daily" ? t("askDailyBody") : t("askWaitingBody");
  return (
    <section
      aria-label={title}
      className="flex animate-[rise_300ms_var(--ease-out)_both] flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-4"
    >
      <BellRingingIcon aria-hidden size={24} className="shrink-0 text-accent-ink" />
      <div className="grid min-w-0 flex-[1_1_180px] gap-1">
        <span className="text-[16px] leading-tight font-semibold">{title}</span>
        <span className="text-[14px] leading-[1.4] text-text-muted">{body}</span>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="ghost" size="md" onClick={later}>
          {t("askLater")}
        </Button>
        <Button size="md" loading={busy} onClick={yes} className="px-5">
          {t("askYes")}
        </Button>
      </div>
    </section>
  );
}
