import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ErrorScreen } from "@/components/site/ErrorScreen";

export const metadata: Metadata = { title: "SPIL", robots: { index: false, follow: false } };

/** Where a banned player lands (admin console bans, owner request 2026-11-12). */
export default function Banned() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader back="/" />
      <ErrorScreen variant="banned" />
    </div>
  );
}
