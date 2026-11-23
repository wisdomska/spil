import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { InstallGuide } from "@/components/pwa/InstallGuide";
import { IntlScope } from "@/components/site/IntlScope";
import { SiteHeader } from "@/components/site/SiteHeader";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pwa");
  return pageMetadata({ title: t("title"), description: t("lede"), path: "/install" });
}

/** Install SPIL as an app and turn on notifications (owner request 2026-11-23). */
export default function InstallPage() {
  return (
    <IntlScope scope="install">
      <div className="flex min-h-[100dvh] flex-col">
        <SiteHeader back="/" />
        <InstallGuide />
      </div>
    </IntlScope>
  );
}
