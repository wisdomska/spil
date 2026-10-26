"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { track } from "@/lib/analytics/posthog";

// Only the "waking" variant shows the vessel; loading it on demand keeps Motion out of every
// page bundle (the root error boundary imports this screen).
const Vessel = dynamic(() => import("@/components/brand/Vessel").then((m) => m.Vessel));

export type ErrorVariant =
  | "notfound"
  | "expired"
  | "full"
  | "started"
  | "offline"
  | "removed"
  | "waking"
  | "server"
  | "notFoundPage"
  | "tooYoung"
  | "ageRestricted";

type Action = { label: string; href?: string; onClick?: () => void };

const PRIMARY =
  "flex h-14 items-center justify-center rounded-pill border-0 bg-accent text-[17px] leading-none font-semibold text-on-accent no-underline hover:text-on-accent hover:shadow-[inset_0_0_0_99px_var(--press-glow)] active:scale-[.97]";
const ALT =
  "flex h-12 items-center justify-center rounded-pill border-0 bg-transparent text-[16px] leading-none font-semibold text-text no-underline hover:bg-surface-raised hover:text-text";

function ActionButton({ action, className }: { action: Action; className: string }) {
  return action.href ? (
    <Link href={action.href} className={className}>
      {action.label}
    </Link>
  ) : (
    <button type="button" onClick={action.onClick} className={className}>
      {action.label}
    </button>
  );
}

/** Error states from the design (ERRS): a slapped sticker, headline, body and up to two actions. */
export function ErrorScreen({
  variant,
  maxPlayers = 12,
  onRetry,
}: {
  variant: ErrorVariant;
  maxPlayers?: number;
  onRetry?: () => void;
}) {
  const t = useTranslations("error");
  const c = useTranslations("common");
  const start: Action = { label: c("startRoom"), href: "/create" };
  const join: Action = { label: c("joinWithCode"), href: "/join" };
  const home: Action = { label: c("backHome"), href: "/" };
  const retry: Action = { label: c("tryAgain"), onClick: onRetry ?? (() => location.reload()) };

  const map: Record<ErrorVariant, { cta?: Action; alt?: Action; accent?: boolean }> = {
    notfound: { cta: join, alt: start },
    expired: { cta: start, alt: join },
    full: { cta: start, alt: join },
    started: { cta: home },
    offline: { cta: retry, accent: true },
    removed: { cta: start, alt: home },
    waking: {},
    server: { cta: retry, alt: home, accent: true },
    notFoundPage: { cta: home, alt: start },
    // SPIL-02: no retry; the age stays locked on this device for a day.
    tooYoung: { cta: home },
    ageRestricted: { cta: start, alt: home },
  };
  const { cta, alt, accent } = map[variant];
  const waking = variant === "waking";
  useEffect(() => track("error_shown", { variant }), [variant]);

  return (
    <main className="mx-auto box-border flex w-full max-w-[520px] flex-1 flex-col justify-center gap-[22px] overflow-x-clip px-5 pt-5 pb-10">
      {waking ? (
        <div>
          <Vessel level={45} height={140} transition="transform 3s var(--ease-in-out)" />
        </div>
      ) : (
        <span
          className="inline-flex animate-slap self-start border-[6px] border-sticker-edge px-[26px] py-4 font-display text-[34px] leading-none font-extrabold uppercase"
          style={{
            background: accent ? "var(--accent)" : "var(--inverse)",
            color: accent ? "var(--on-accent)" : "var(--on-inverse)",
            borderRadius: 14,
            boxShadow: "0 0 0 1.5px var(--sticker-ring), 0 14px 24px -14px var(--shadow)",
            fontStretch: "78%",
            rotate: "-4deg",
          }}
        >
          {t(`${variant}.sticker`)}
        </span>
      )}
      <h1 className="m-0 font-display text-display-l font-extrabold tracking-display text-balance">
        {t(`${variant}.title`)}
      </h1>
      <p className="m-0 text-[17px] leading-[1.5] text-pretty text-text-muted">
        {t(`${variant}.body`, { max: maxPlayers })}
      </p>
      {cta && (
        <div className="mt-1.5 grid gap-2">
          <ActionButton action={cta} className={PRIMARY} />
          {alt && <ActionButton action={alt} className={ALT} />}
        </div>
      )}
      {waking && (
        <div aria-hidden className="grid animate-breathe gap-3.5">
          <Skeleton className="h-3 w-24 rounded-pill" />
          <Skeleton className="h-14 w-[220px] rounded-input" />
          <div className="flex gap-2.5">
            <Skeleton className="h-[50px] w-[120px] rounded-pill" style={{ rotate: "-3deg" }} />
            <Skeleton className="h-[50px] w-[100px] rounded-pill" style={{ rotate: "2deg" }} />
          </div>
        </div>
      )}
    </main>
  );
}
