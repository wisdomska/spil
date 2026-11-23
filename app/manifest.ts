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
  const c = await getTranslations("common");
  const shortcutIcon = [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }];
  return {
    // A fixed id: the installed app stays the same app if start_url ever changes.
    id: "/",
    name: "SPIL",
    short_name: "SPIL",
    description: t("description"),
    // Opened from the home screen it goes straight to the game picker (see InstalledRedirect).
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: THEME_COLOR,
    theme_color: THEME_COLOR,
    categories: ["games", "entertainment", "social"],
    lang: "en",
    dir: "ltr",
    prefer_related_applications: false,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Long-press the app icon (Android, desktop) to jump straight in.
    shortcuts: [
      { name: c("startRoom"), url: "/create?source=pwa", icons: shortcutIcon },
      { name: c("joinWithCode"), url: "/join?source=pwa", icons: shortcutIcon },
      { name: c("todaysSpill"), url: "/daily?source=pwa", icons: shortcutIcon },
    ],
  };
}
