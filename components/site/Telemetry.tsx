"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { useEffect } from "react";
import { initAnalytics } from "@/lib/analytics/posthog";

// Vercel serves these scripts only when Web Analytics and Speed Insights are enabled for the
// project (dashboard toggles); NEXT_PUBLIC_VERCEL_ANALYTICS=1 turns them on so nothing 404s.
const ON_VERCEL = process.env.NEXT_PUBLIC_VERCEL_ANALYTICS === "1";

/** Vercel Analytics and Speed Insights on Vercel; PostHog when a key is set, after hydration. */
export function Telemetry() {
  useEffect(() => {
    const id = window.setTimeout(initAnalytics, 1500);
    return () => window.clearTimeout(id);
  }, []);
  if (!ON_VERCEL) return null;
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
