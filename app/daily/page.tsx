import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { DailySpill } from "@/components/daily/DailySpill";
import { IntlScope } from "@/components/site/IntlScope";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getSettings } from "@/lib/flags";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("dailyTitle") };
}

async function Daily() {
  // The age lock comes from the admin console: read it per request.
  await connection();
  const settings = await getSettings();
  return (
    <IntlScope scope="daily">
      <DailySpill ageLockHours={settings.ageLockHours} />
    </IntlScope>
  );
}

/** Daily Spill: one question a day for everyone. */
export default function DailyPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader back="/" />
      <Suspense>
        <Daily />
      </Suspense>
    </div>
  );
}
