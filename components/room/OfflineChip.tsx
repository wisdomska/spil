"use client";

import { useTranslations } from "next-intl";

/** Grey chip for a player out of the room's presence for more than 10 s (SPIL-03). */
export function OfflineChip() {
  const c = useTranslations("common");
  return (
    <span className="rounded-pill bg-surface-raised px-2 py-1 text-[12px] leading-none font-semibold text-text-muted">
      {c("offline")}
    </span>
  );
}
