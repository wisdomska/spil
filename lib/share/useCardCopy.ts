"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

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
      topped: (name: string) => t("card.topped", { name }),
      headline: t("landing.headline"),
      headlineEmphasis: t("landing.headlineEmphasis"),
      domain: t("card.domain"),
      saved: t("toast.cardSaved"),
    }),
    [t],
  );
}
