import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SignInPage } from "@/components/account/SignInPages";
import { IntlScope } from "@/components/site/IntlScope";
import { SiteHeader } from "@/components/site/SiteHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("metaSignIn"), robots: { index: false, follow: false } };
}

export default function Route() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader back="/profile" />
      <IntlScope scope="account">
        <SignInPage />
      </IntlScope>
    </div>
  );
}
