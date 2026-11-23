import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ErrorScreen } from "@/components/site/ErrorScreen";

export const metadata: Metadata = { title: "SPIL", robots: { index: false, follow: false } };

/**
 * What the installed app shows with no connection instead of the browser's own page (owner
 * request 2026-11-23). The service worker keeps a copy and serves it for any page it cannot
 * reach; Try again reloads the page that failed.
 */
export default function Offline() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader back="/" />
      <ErrorScreen variant="offline" />
    </div>
  );
}
