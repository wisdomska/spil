import { getTranslations } from "next-intl/server";
import { ogCard } from "@/lib/og";

/** Default site Open Graph image (spec section 16). */
export async function GET() {
  const t = await getTranslations();
  return ogCard({
    headline: t("landing.headline"),
    emphasis: t("landing.headlineEmphasis"),
    footer: t("card.domain"),
  });
}
