import type { Metadata } from "next";

/** The public address. Canonical links, the sitemap and structured data all point here. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://spil-party.vercel.app"
).replace(/\/$/, "");

/**
 * Only production is indexed. Staging and PR previews serve the same pages, and letting search
 * engines index them would split SPIL's ranking across copies.
 */
export const INDEXABLE = process.env.APP_ENV === "production";

export const absolute = (path: string) => `${SITE_URL}${path === "/" ? "" : path}`;

/** Title, description, canonical link and social cards for one public page. */
export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
}: {
  title: string;
  description: string;
  path: string;
  /** Use the title as given, without the "· SPIL" suffix. */
  absoluteTitle?: boolean;
}): Metadata {
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: "SPIL",
      type: "website",
      images: ["/og"],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/og"] },
  };
}
