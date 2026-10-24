import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { livePacks } from "@/lib/api/packs";
import { getSettings } from "@/lib/flags";
import { CreateRoom, PickerSkeleton } from "./CreateRoom";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("packs");
  return { title: t("title") };
}

async function Picker() {
  // Packs and settings change from the admin console: always read them per request. Only the
  // 13+ packs are rendered here; older bands fetch theirs after the age screen (SPIL-02), so an
  // under-18 player's page never carries an adult pack.
  await connection();
  const [packs, settings] = await Promise.all([livePacks(13), getSettings()]);
  return (
    <CreateRoom
      packs={packs}
      questionsPerGame={settings.questionsPerGame}
      ageLockHours={settings.ageLockHours}
    />
  );
}

export default async function CreatePage() {
  const t = await getTranslations("packs");
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader back="/" />
      <Suspense fallback={<PickerSkeleton label={t("group")} />}>
        <Picker />
      </Suspense>
    </div>
  );
}
