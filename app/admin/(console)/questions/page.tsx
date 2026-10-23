import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { QuestionsSection } from "@/components/admin/sections/QuestionsSection";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("questions") };
}

export default function QuestionsPage() {
  // Reads ?pack= (the Packs "Questions" action), so it renders behind Suspense.
  return (
    <Suspense>
      <QuestionsSection />
    </Suspense>
  );
}
