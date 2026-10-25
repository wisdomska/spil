import type { MetadataRoute } from "next";
import { getTranslations } from "next-intl/server";
import { THEME_COLOR } from "@/lib/theme-color";

/**
 * Install to home screen (SPIL-30): opens full screen on the dark background. Colours are the
 * same bg token the viewport theme uses (SPIL is dark only); icons come from
 * scripts/build-icons.mjs.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations("meta");
  return {
    name: "SPIL",
    short_name: "SPIL",
    description: t("description"),
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: THEME_COLOR,
    theme_color: THEME_COLOR,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
