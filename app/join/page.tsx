import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageMetadata } from "@/lib/seo";
import { Suspense } from "react";
import { IntlScope } from "@/components/site/IntlScope";
import { SiteHeader } from "@/components/site/SiteHeader";
import { JoinForm } from "./JoinForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return pageMetadata({ title: t("joinTitle"), description: t("joinDescription"), path: "/join" });
}

export default async function JoinPage() {
  const t = await getTranslations("join");
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader back="/" />
      <main className="mx-auto box-border flex w-full max-w-[480px] flex-1 flex-col gap-[22px] px-5 pt-4 pb-7">
        <h1 className="m-0 font-display text-display-l font-extrabold tracking-display">
          {t("title")}
        </h1>
        <p className="m-0 text-[17px] leading-[1.5] text-text-muted">{t("lede")}</p>
        <Suspense>
          <IntlScope scope="join">
            <JoinForm />
          </IntlScope>
        </Suspense>
      </main>
    </div>
  );
}
