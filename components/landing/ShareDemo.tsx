"use client";

import { DeviceMobileIcon, EyeSlashIcon, InfoIcon, SquareIcon } from "@phosphor-icons/react";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { useTranslations } from "next-intl";
import { useRef, useState, useSyncExternalStore } from "react";
import type { AwardKey } from "@/components/brand/Stickers";
import { ShareCard, type BoardRow } from "@/components/game/ShareCard";
import { Button } from "@/components/ui/Button";
import { SwitchRow } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { cardToBlob, daysSince, downloadBlob, LAST_KEY, type LastGame } from "@/lib/share/capture";
import { useIsDesktop } from "@/lib/useMedia";
import { useCardCopy } from "@/lib/share/useCardCopy";

const SAMPLE: BoardRow[] = (
  [
    ["Jordan", 14, 88],
    ["Alex", 0, 72],
    ["Theo", 18, 57],
    ["Leo", 5, 41],
    ["Maya", 9, 18],
    ["Ivy", 3, 9],
  ] as const
).map(([name, avatar, score], i) => ({ rank: i + 1, name, avatar, score }));

function useLastGame(): LastGame | null {
  const raw = useSyncExternalStore(
    (cb) => {
      window.addEventListener("storage", cb);
      return () => window.removeEventListener("storage", cb);
    },
    () => {
      try {
        return localStorage.getItem(LAST_KEY);
      } catch {
        return null;
      }
    },
    () => null,
  );
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LastGame;
  } catch {
    return null;
  }
}

export function ShareDemo() {
  const t = useTranslations("landing");
  const toast = useToast();
  const copy = useCardCopy();
  const desktop = useIsDesktop();
  const last = useLastGame();
  const [format, setFormat] = useState<"story" | "square">("story");
  const [hide, setHide] = useState(false);
  const [busy, setBusy] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);

  const square = format === "square";
  const scale = square ? (desktop ? 0.4 : 0.27) : desktop ? 0.25 : 0.22;
  const props = {
    name: last?.name ?? "Alex",
    hideName: hide,
    avatar: last?.avatar ?? 0,
    score: last?.score ?? 72,
    // A real last game shows only an award that was won; the sample shows one.
    award: last ? (last.award as AwardKey) || undefined : ("open_book" as AwardKey),
    room: last?.room ?? "K7QX",
    board: last?.board ?? SAMPLE,
    copy,
  };

  const ago = (() => {
    if (!last) return "";
    const days = daysSince(last.at);
    return days < 1 ? t("today") : days === 1 ? t("yesterday") : t("daysAgo", { n: days });
  })();

  const download = async () => {
    if (!last || !captureRef.current) return;
    setBusy(true);
    try {
      const blob = await cardToBlob(captureRef.current);
      downloadBlob(blob, `spil-${last.room}-${square ? "group" : "story"}.png`);
      toast(copy.saved);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="[container-type:inline-size] mx-auto box-border grid w-full max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] items-center gap-x-14 gap-y-10 border-t border-line px-5 py-14">
      <div className="grid content-center gap-5">
        <span className="font-mono text-[12px] leading-none font-medium tracking-[.08em] text-accent-ink">
          {t("shareKicker")}
        </span>
        <h2 className="m-0 font-display text-[clamp(36px,5cqi,52px)] leading-[.95] font-extrabold tracking-[-.035em] text-balance">
          {t("shareTitle")}{" "}
          <span className="text-accent-ink" style={{ fontStretch: "75%" }}>
            {t("shareTitleEmphasis")}
          </span>
        </h2>
        <p className="m-0 max-w-[440px] text-[17px] leading-[1.55] text-pretty text-text-muted">
          {t("shareBody")}
        </p>
        <div className="grid max-w-[420px] gap-3 rounded-card border border-line bg-surface p-4">
          <RadioGroup.Root
            aria-label={t("cardFormat")}
            value={format}
            onValueChange={(v) => setFormat(v as "story" | "square")}
            className="flex gap-1 rounded-pill bg-bg p-1"
          >
            {(
              [
                ["story", t("story"), DeviceMobileIcon],
                ["square", t("group"), SquareIcon],
              ] as const
            ).map(([value, label, Icon]) => (
              <RadioGroup.Item
                key={value}
                value={value}
                className={cn(
                  "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-pill border-0 text-[14px] leading-none font-semibold",
                  format === value
                    ? "bg-surface-raised text-text shadow-[0_1px_0_var(--line)]"
                    : "bg-transparent text-text-muted hover:text-text",
                )}
              >
                <Icon size={18} aria-hidden />
                {label}
              </RadioGroup.Item>
            ))}
          </RadioGroup.Root>
          <SwitchRow
            look="plain"
            checked={hide}
            onCheckedChange={setHide}
            title={t("hideMyName")}
            icon={<EyeSlashIcon size={20} aria-hidden className="text-text-muted" />}
          />
        </div>
        {last ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={download} loading={busy}>
              {t("downloadPng")}
            </Button>
            <span className="text-[13px] leading-[1.4] font-medium text-text-muted">
              {t("lastLine", { room: last.room, ago })}
            </span>
          </div>
        ) : (
          <span className="flex items-center gap-2 text-[13px] leading-[1.4] font-medium text-text-muted">
            <InfoIcon size={16} aria-hidden className="shrink-0" />
            {t("sample")}
          </span>
        )}
      </div>
      <div
        className="relative grid min-h-[560px] place-items-center overflow-hidden rounded-[28px] border border-line bg-surface"
        style={{
          backgroundImage: "radial-gradient(var(--halftone) 1.4px, transparent 1.6px)",
          backgroundSize: "10px 10px",
        }}
      >
        <div
          aria-hidden
          className="absolute aspect-square w-[62%] rounded-full bg-accent opacity-[.14] blur-[60px]"
        />
        <div
          className="relative leading-[0]"
          style={{
            transform: `rotate(${square ? 2 : -3}deg)`,
            transition: "transform 300ms var(--ease-return)",
            filter: "drop-shadow(0 30px 40px var(--shadow))",
          }}
        >
          <ShareCard format={format} scale={scale} {...props} />
        </div>
      </div>
      {/* Full-size copy for PNG capture, off screen. */}
      {last && (
        <div aria-hidden className="pointer-events-none fixed top-0 -left-[10000px]">
          <ShareCard ref={captureRef} format={format} {...props} />
        </div>
      )}
    </section>
  );
}
