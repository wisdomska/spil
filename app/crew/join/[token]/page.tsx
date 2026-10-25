import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { IntlScope } from "@/components/site/IntlScope";
import { SiteHeader } from "@/components/site/SiteHeader";
import { JoinCrew } from "@/components/crews/CrewsPages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("crewTitle"), robots: { index: false, follow: false } };
}

async function Join({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <IntlScope scope="crews">
      <JoinCrew token={token} />
    </IntlScope>
  );
}

/** Join a crew from its invite link (Batch 3). */
export default function JoinCrewRoute({ params }: PageProps<"/crew/join/[token]">) {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader back="/" />
      <Suspense>
        <Join params={params} />
      </Suspense>
    </div>
  );
}
