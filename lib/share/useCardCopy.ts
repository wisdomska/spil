"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { AWARD_KEY, type AwardKey } from "@/components/brand/Stickers";

/** All text a ShareCard prints, from messages/en.json. */
export function useCardCopy() {
  const t = useTranslations();
  return useMemo(
    () => ({
      spillScore: t("card.spillScore"),
      owner: (name: string) => t("card.owner", { name }),
      mine: t("card.mine"),
      tagline: t("card.tagline"),
      room: (code: string) => t("card.room", { code }),
      topped: (names: string[]) =>
        names.length > 1
          ? t("card.toppedTie", { names: names.join(", ") })
          : t("card.topped", { name: names[0] ?? "" }),
      headline: t("landing.headline"),
      headlineEmphasis: t("landing.headlineEmphasis"),
      domain: t("card.domain"),
      saved: t("toast.cardSaved"),
      awardName: (award: AwardKey) => t(`awards.${AWARD_KEY[award]}`),
    }),
    [t],
  );
}
