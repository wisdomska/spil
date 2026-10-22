import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { livePacks } from "@/lib/api/packs";
import { getSettings } from "@/lib/flags";
import { CreateRoom } from "./CreateRoom";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("packs");
  return { title: t("title") };
}

async function Picker() {
  // Packs and settings change from the admin console: always read them per request.
  await connection();
  const [packs, settings] = await Promise.all([livePacks(), getSettings()]);
  return <CreateRoom packs={packs} questionsPerGame={settings.questionsPerGame} />;
}

export default async function CreatePage() {
  const t = await getTranslations("packs");
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader back="/" />
      <main className="mx-auto box-border flex w-full max-w-[880px] flex-1 flex-col gap-5 px-5 pt-4 pb-7">
        <h1 className="m-0 font-display text-display-l font-extrabold tracking-display">
          {t("title")}
        </h1>
        <p className="m-0 text-[17px] leading-[1.5] text-text-muted">{t("lede")}</p>
        <Suspense
          fallback={
            <SkeletonGroup label={t("group")} className="grid-cols-2 gap-3 p-2 lg:grid-cols-3">
              <Skeleton className="col-span-full h-[230px] rounded-card" />
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-[230px] rounded-card" />
              ))}
            </SkeletonGroup>
          }
        >
          <Picker />
        </Suspense>
      </main>
    </div>
  );
}
