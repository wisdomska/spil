"use client";

import { BellRingingIcon, BellSlashIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SwitchRow } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { track } from "@/lib/analytics/posthog";
import {
  disablePush,
  enablePush,
  pushSupport,
  readPush,
  updatePush,
  type PushPrefs,
  type PushSupport,
} from "@/lib/pwa/pwa";

type State =
  | { kind: "loading" }
  | { kind: "off"; support: PushSupport; blocked: boolean }
  | { kind: "on"; prefs: PushPrefs };

/**
 * Notifications on this phone (owner request 2026-11-23): turn on, the two kinds as switches,
 * and turn off. iPhones in Safari are told to install first; browsers without push see nothing.
 */
export function PushSettings({ from }: { from: "profile" | "install" }) {
  const t = useTranslations("pwa");
  const toast = useToast();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    const support = pushSupport();
    void (async () => {
      const prefs = support === "ready" ? await readPush() : null;
      if (!live) return;
      setState(
        prefs
          ? { kind: "on", prefs }
          : {
              kind: "off",
              support,
              blocked: support === "ready" && Notification.permission === "denied",
            },
      );
    })();
    return () => {
      live = false;
    };
  }, []);

  if (state.kind === "loading" || (state.kind === "off" && state.support === "unsupported"))
    return null;

  const turnOn = async () => {
    setBusy(true);
    try {
      const result = await enablePush();
      if (result === "granted") {
        track("push_enabled", { from });
        setState({ kind: "on", prefs: (await readPush()) ?? { gameUpdates: true, daily: true } });
        toast(t("notifyEnabled"));
      } else if (result === "denied") {
        setState({ kind: "off", support: "ready", blocked: true });
      }
    } catch {
      toast(t("notifyFailed"), "err");
    } finally {
      setBusy(false);
    }
  };

  const change = async (patch: Partial<PushPrefs>) => {
    if (state.kind !== "on") return;
    const before = state.prefs;
    setState({ kind: "on", prefs: { ...before, ...patch } });
    try {
      const saved = await updatePush(patch);
      if (saved) setState({ kind: "on", prefs: saved });
    } catch {
      setState({ kind: "on", prefs: before });
      toast(t("notifyFailed"), "err");
    }
  };

  const turnOff = async () => {
    setBusy(true);
    await disablePush();
    setBusy(false);
    setState({ kind: "off", support: "ready", blocked: false });
    toast(t("notifyDisabled"));
  };

  return (
    <section aria-labelledby="push-settings-title" className="grid gap-3">
      <div className="grid gap-1.5">
        <h2 id="push-settings-title" className="m-0 text-[18px] leading-none font-bold">
          {t("notifyTitle")}
        </h2>
        <p className="m-0 text-[15px] leading-[1.45] text-text-muted">{t("notifyBody")}</p>
      </div>
      {state.kind === "on" ? (
        <>
          <SwitchRow
            look="plain"
            className="-mx-2 w-[calc(100%+16px)]"
            checked={state.prefs.gameUpdates}
            onCheckedChange={(v) => change({ gameUpdates: v })}
            title={t("gameUpdates")}
            description={t("gameUpdatesBody")}
          />
          <SwitchRow
            look="plain"
            className="-mx-2 w-[calc(100%+16px)]"
            checked={state.prefs.daily}
            onCheckedChange={(v) => change({ daily: v })}
            title={t("daily")}
            description={t("dailyBody")}
          />
          <Button
            variant="ghost"
            size="md"
            loading={busy}
            onClick={turnOff}
            className="justify-self-start"
          >
            <BellSlashIcon aria-hidden size={18} />
            {t("notifyOff")}
          </Button>
        </>
      ) : state.support === "needs-install" ? (
        <p className="m-0 rounded-input border border-line bg-surface px-4 py-3 text-[15px] leading-[1.45]">
          {t("notifyNeedsInstall")}
        </p>
      ) : state.blocked ? (
        <p className="m-0 rounded-input border border-line bg-surface px-4 py-3 text-[15px] leading-[1.45] text-text-muted">
          {t("notifyBlocked")}
        </p>
      ) : (
        <Button size="md" loading={busy} onClick={turnOn} className="justify-self-start px-5">
          <BellRingingIcon aria-hidden size={18} />
          {t("notifyOn")}
        </Button>
      )}
    </section>
  );
}
