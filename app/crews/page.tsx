import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { IntlScope } from "@/components/site/IntlScope";
import { SiteHeader } from "@/components/site/SiteHeader";
import { CrewsList } from "@/components/crews/CrewsPages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("crewsTitle"), robots: { index: false, follow: false } };
}

/** Your crews (Batch 3). */
export default function CrewsPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader back="/" />
      <Suspense>
        <IntlScope scope="crews">
          <CrewsList />
        </IntlScope>
      </Suspense>
    </div>
  );
}
