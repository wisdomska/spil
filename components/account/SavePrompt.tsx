"use client";

import { CloudCheckIcon, XIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { useDeviceAccount } from "@/lib/account/device";

type Reason = "crew" | "badge" | "streak";

const dismissKey = (reason: Reason) => `spil.savePrompt.${reason}`;
const noop = () => () => {};

function wasDismissed(reason: Reason) {
  try {
    return localStorage.getItem(dismissKey(reason)) === "1";
  } catch {
    return true;
  }
}

/**
 * Offers to save progress at a moment worth keeping: a first crew, a first badge, a 3-day
 * streak. Never shown to accounts; "Not now" hides it for that moment on this phone.
 */
export function SavePrompt({ reason, days }: { reason: Reason; days?: number }) {
  const t = useTranslations("account");
  const account = useDeviceAccount();
  const stored = useSyncExternalStore(
    noop,
    () => wasDismissed(reason),
    () => true,
  );
  const [hidden, setHidden] = useState(false);
  if (account || stored || hidden) return null;

  const message =
    reason === "crew"
      ? t("promptCrew")
      : reason === "badge"
        ? t("promptBadge")
        : t("promptStreak", { days: days ?? 3 });

  return (
    <aside className="flex animate-rise items-start gap-3 rounded-card border-[1.5px] border-accent bg-accent-soft p-4">
      <CloudCheckIcon
        aria-hidden
        size={24}
        weight="bold"
        className="mt-0.5 shrink-0 text-accent-ink"
      />
      <div className="grid min-w-0 flex-1 gap-2.5">
        <p className="m-0 text-[15px] leading-[1.4] font-semibold text-pretty">{message}</p>
        <Link
          href="/profile#account"
          className="flex h-10 w-fit items-center rounded-pill bg-accent px-4 text-[15px] leading-none font-bold text-on-accent no-underline hover:text-on-accent"
        >
          {t("promptAction")}
        </Link>
      </div>
      <button
        type="button"
        aria-label={t("promptDismiss")}
        onClick={() => {
          try {
            localStorage.setItem(dismissKey(reason), "1");
          } catch {}
          setHidden(true);
        }}
        className="-mt-1.5 -mr-1.5 grid size-11 shrink-0 place-items-center rounded-pill border-0 bg-transparent text-text-muted hover:text-text"
      >
        <XIcon aria-hidden size={18} />
      </button>
    </aside>
  );
}
