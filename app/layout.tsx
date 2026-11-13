import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { fontVariables } from "./fonts";
import { Grain } from "@/components/brand/Grain";
import { Telemetry } from "@/components/site/Telemetry";
import { NoticeBanner } from "@/components/site/NoticeBanner";
import { Providers } from "./providers";
import { BASE_SCOPE, pickMessages } from "@/lib/i18n/pick";
import { INDEXABLE, SITE_URL, siteVerification } from "@/lib/seo";
import { THEME_COLOR } from "@/lib/theme-color";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t("title"), template: "%s · SPIL" },
    description: t("description"),
    applicationName: "SPIL",
    authors: [{ name: "Senya", url: "https://wisdomska.site" }],
    creator: "Senya",
    category: "games",
    // Only production is indexed; staging and previews would compete with it.
    robots: INDEXABLE ? { index: true, follow: true } : { index: false, follow: false },
    verification: siteVerification(),
    openGraph: { type: "website", siteName: "SPIL", images: ["/og"] },
    twitter: { card: "summary_large_image" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // SPIL is dark only (owner decision 2026-10-23); the light tokens stay in tokens.css unused.
  themeColor: THEME_COLOR,
  colorScheme: "dark",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // SPIL-07: only what every page needs; routes add their own namespaces with IntlScope.
  const messages = pickMessages(await getMessages(), BASE_SCOPE);
  return (
    <html lang="en" data-theme="dark" className={fontVariables}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <NoticeBanner />
            {children}
          </Providers>
        </NextIntlClientProvider>
        <Grain />
        <Telemetry />
      </body>
    </html>
  );
}
