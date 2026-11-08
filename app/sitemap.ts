import type { MetadataRoute } from "next";
import { GAME_PAGES } from "@/lib/game-pages";
import { absolute, INDEXABLE } from "@/lib/seo";

/** Every public page. Rooms, accounts and the admin console are left out on purpose. */
export default function sitemap(): MetadataRoute.Sitemap {
  if (!INDEXABLE) return [];
  const page = (
    path: string,
    priority: number,
    changeFrequency: "daily" | "weekly" | "monthly",
  ) => ({
    url: absolute(path),
    changeFrequency,
    priority,
  });
  return [
    page("/", 1, "weekly"),
    page("/games", 0.9, "weekly"),
    ...GAME_PAGES.map((g) => page(`/games/${g.slug}`, 0.8, "monthly")),
    page("/how-to-play", 0.8, "monthly"),
    page("/faq", 0.7, "monthly"),
    page("/daily", 0.6, "daily"),
    page("/create", 0.6, "monthly"),
    page("/join", 0.5, "monthly"),
    page("/safety", 0.4, "monthly"),
    page("/privacy", 0.3, "monthly"),
    page("/terms", 0.3, "monthly"),
    page("/contact", 0.3, "monthly"),
  ];
}
