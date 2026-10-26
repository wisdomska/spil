import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { IntlScope } from "@/components/site/IntlScope";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ProfilePage } from "@/components/profile/ProfilePage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profilePage");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

/** Profile settings: the name and face this phone remembers. */
export default function ProfileRoute() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader back="/" />
      <IntlScope scope="profilePage">
        <ProfilePage />
      </IntlScope>
    </div>
  );
}
