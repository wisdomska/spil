"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/** Retry every this often while the room cannot load. */
const RETRY_MS = 3000;
/** Say something only once it has been slow for this long. */
const SLOW_MS = 6000;

/**
 * Owner request: a passing server hiccup is not the player's business. While the room cannot load,
 * this retries quietly; only after a few seconds does it say it is taking longer than usual, with
 * a way to try again. No talk of servers. Mounted only while loading is failing, so its timers
 * start fresh each time.
 */
export function LoadingRetry({
  onRetry,
  floating = false,
}: {
  onRetry: () => void;
  /** Over a game already on screen: a small pill at the bottom instead of a line in place. */
  floating?: boolean;
}) {
  const t = useTranslations("room");
  const [slow, setSlow] = useState(false);
  // The timers start once per mount; the latest retry function is read from a ref.
  const retry = useRef(onRetry);
  useEffect(() => {
    retry.current = onRetry;
  }, [onRetry]);
  useEffect(() => {
    const every = setInterval(() => retry.current(), RETRY_MS);
    const late = setTimeout(() => setSlow(true), SLOW_MS);
    return () => {
      clearInterval(every);
      clearTimeout(late);
    };
  }, []);

  if (!slow) return null;
  return (
    <p
      role="status"
      className={cn(
        "m-0 flex items-center gap-2 text-[14px] leading-[1.4] text-text-muted",
        floating
          ? "fixed bottom-[calc(16px+env(safe-area-inset-bottom))] left-1/2 z-20 -translate-x-1/2 rounded-pill border border-line bg-surface px-4 py-2.5 whitespace-nowrap shadow-[0_8px_24px_-12px_var(--shadow)]"
          : "mt-5 justify-center",
      )}
    >
      {t("slow")}
      <button
        type="button"
        onClick={onRetry}
        className="min-h-11 border-0 bg-transparent px-1 text-[14px] leading-none font-semibold text-accent-ink underline underline-offset-4"
      >
        {t("slowRetry")}
      </button>
    </p>
  );
}
