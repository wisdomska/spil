"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/site/ErrorScreen";
import { SiteHeader } from "@/components/site/SiteHeader";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader back="/" />
      <ErrorScreen variant={offline ? "offline" : "server"} onRetry={reset} />
    </div>
  );
}
