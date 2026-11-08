import type { MetadataRoute } from "next";
import { INDEXABLE, SITE_URL } from "@/lib/seo";

/** Rooms, accounts and the admin console are private; everything else is open to search and AI crawlers. */
const PRIVATE = [
  "/admin",
  "/api/",
  "/r/",
  "/crew/",
  "/crews",
  "/badges",
  "/profile",
  "/sign-in",
  "/recover",
  "/dev/",
];

export default function robots(): MetadataRoute.Robots {
  // Staging and previews must never compete with the real site.
  if (!INDEXABLE) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      // Named so the welcome is explicit: AI assistants may read and cite the public pages.
      {
        userAgent: [
          "GPTBot",
          "OAI-SearchBot",
          "ChatGPT-User",
          "ClaudeBot",
          "Claude-SearchBot",
          "PerplexityBot",
          "Google-Extended",
          "Applebot-Extended",
          "CCBot",
        ],
        allow: "/",
        disallow: PRIVATE,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
