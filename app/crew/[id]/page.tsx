import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { IntlScope } from "@/components/site/IntlScope";
import { SiteHeader } from "@/components/site/SiteHeader";
import { CrewPage } from "@/components/crews/CrewPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("crewTitle"), robots: { index: false, follow: false } };
}

async function Crew({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <IntlScope scope="crews">
      <CrewPage id={id} />
    </IntlScope>
  );
}

/** A crew's season table, history and members (Batch 3). Members only. */
export default function CrewRoute({ params }: PageProps<"/crew/[id]">) {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader back="/crews" />
      <Suspense>
        <Crew params={params} />
      </Suspense>
    </div>
  );
}
