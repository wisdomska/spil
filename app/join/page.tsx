import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { JoinForm } from "./JoinForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("join");
  return { title: t("title") };
}

export default function JoinPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader back="/" />
      <Suspense>
        <JoinForm />
      </Suspense>
    </div>
  );
}
