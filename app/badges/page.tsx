import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BadgesPage } from "@/components/badges/BadgesPage";
import { IntlScope } from "@/components/site/IntlScope";
import { SiteHeader } from "@/components/site/SiteHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("badgesTitle"), robots: { index: false, follow: false } };
}

/** Your badges, frames and card looks (Batch 3). */
export default function BadgesRoute() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader back="/" />
      <Suspense>
        <IntlScope scope="badges">
          <BadgesPage />
        </IntlScope>
      </Suspense>
    </div>
  );
}
