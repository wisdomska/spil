"use client";

import {
  ArrowRightIcon,
  CheckCircleIcon,
  DesktopIcon,
  DotsThreeVerticalIcon,
  DownloadSimpleIcon,
  ExportIcon,
  PlusSquareIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { promptInstall, useInstallState } from "@/lib/pwa/install";
import { platform } from "@/lib/pwa/pwa";
import { PushSettings } from "./PushSettings";

type Device = "iphone" | "android" | "computer";
const DEVICES: Device[] = ["iphone", "android", "computer"];

const noop = () => () => {};
const detect = (): Device => {
  const p = platform();
  return p === "ios" ? "iphone" : p === "android" ? "android" : "computer";
};

/**
 * Put SPIL on the home screen (owner request 2026-11-23, modelled on Clink's install guide):
 * the steps for this device (picked for you, switchable), one tap where the browser can install
 * it, and once it is installed, notifications.
 */
export function InstallGuide() {
  const t = useTranslations("pwa");
  const tc = useTranslations("common");
  const install = useInstallState();
  const detected = useSyncExternalStore(noop, detect, () => "iphone" as Device);
  const [picked, setPicked] = useState<Device | null>(null);
  const device = picked ?? detected;
  const [justInstalled, setJustInstalled] = useState(false);
  const installed = install === "installed" || justInstalled;

  const From =
    device === "iphone" ? ExportIcon : device === "android" ? DotsThreeVerticalIcon : DesktopIcon;
  const To = device === "iphone" ? PlusSquareIcon : DownloadSimpleIcon;
  const steps = t.raw(`steps.${device}`) as string[];

  return (
    <main className="mx-auto box-border grid w-full max-w-[560px] flex-1 content-start gap-6 px-5 pt-4 pb-12">
      <div className="grid gap-2.5">
        <h1 className="m-0 font-display text-display-l font-extrabold tracking-display text-balance">
          {t("title")}
        </h1>
        <p className="m-0 text-[17px] leading-[1.5] text-pretty text-text-muted">{t("lede")}</p>
      </div>

      {installed ? (
        <section className="grid justify-items-start gap-3 rounded-card border border-line bg-surface p-5">
          <CheckCircleIcon aria-hidden size={40} weight="fill" className="text-accent-ink" />
          <h2 className="m-0 font-display text-[26px] leading-[1.05] font-extrabold">
            {t("installedTitle")}
          </h2>
          <p className="m-0 text-[15px] leading-[1.45] text-text-muted">{t("installedBody")}</p>
          <Link
            href="/create"
            className="mt-1 flex h-12 items-center justify-center rounded-pill bg-accent px-6 text-[16px] leading-none font-semibold text-on-accent no-underline hover:text-on-accent"
          >
            {tc("startRoom")}
          </Link>
        </section>
      ) : (
        <section aria-label={t("stepsLabel")} className="grid gap-5">
          <SegmentedTabs<Device>
            label={t("device")}
            fit={false}
            value={device}
            onValueChange={setPicked}
            items={DEVICES.map((d) => ({ value: d, label: t(d) }))}
          />
          <div
            key={device}
            className="flex h-[150px] animate-[fade_200ms_both] flex-col items-center justify-center gap-3 rounded-card border border-line bg-surface text-text-muted"
          >
            <div className="flex items-center gap-3 text-text">
              <From aria-hidden size={40} />
              <ArrowRightIcon aria-hidden size={20} className="text-text-muted" />
              <To aria-hidden size={40} />
            </div>
            <span className="text-[14px]">{t(`hint.${device}`)}</span>
          </div>
          <ol className="m-0 grid list-none gap-3.5 p-0">
            {steps.map((step, i) => (
              <li key={step} className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-pill border border-line bg-surface font-mono text-[14px] font-semibold">
                  {i + 1}
                </span>
                <span className="text-[16px] leading-[1.4]">{step}</span>
              </li>
            ))}
          </ol>
          <p className="m-0 text-[14px] leading-[1.45] text-text-muted">{t(`note.${device}`)}</p>
          {install === "prompt" && device !== "iphone" && (
            <Button
              block
              onClick={async () => {
                if (await promptInstall()) setJustInstalled(true);
              }}
            >
              <DownloadSimpleIcon aria-hidden size={20} />
              {t("installNow")}
            </Button>
          )}
        </section>
      )}

      <PushSettings from="install" />
    </main>
  );
}
