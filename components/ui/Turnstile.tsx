"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  execute: (id: string) => void;
  reset: (id: string) => void;
  getResponse: (id: string) => string | undefined;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * Invisible Cloudflare Turnstile. `getToken()` resolves to a fresh token, or undefined when no
 * site key is configured (local and CI), in which case the server also skips verification.
 */
export function useTurnstile() {
  const holder = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const waiters = useRef<Array<(token: string | undefined) => void>>([]);

  const render = useCallback(() => {
    if (!SITE_KEY || !holder.current || !window.turnstile || widget.current) return;
    widget.current = window.turnstile.render(holder.current, {
      sitekey: SITE_KEY,
      size: "invisible",
      execution: "execute",
      appearance: "interaction-only",
      callback: (token: string) => {
        waiters.current.splice(0).forEach((resolve) => resolve(token));
      },
      "error-callback": () => {
        waiters.current.splice(0).forEach((resolve) => resolve(undefined));
      },
    });
  }, []);

  useEffect(render, [render]);

  const getToken = useCallback(async (): Promise<string | undefined> => {
    if (!SITE_KEY) return undefined;
    render();
    if (!window.turnstile || !widget.current) return undefined;
    const id = widget.current;
    return new Promise((resolve) => {
      waiters.current.push(resolve);
      window.turnstile!.reset(id);
      window.turnstile!.execute(id);
      setTimeout(() => resolve(undefined), 15_000);
    });
  }, [render]);

  const element = SITE_KEY ? (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={render}
      />
      <div ref={holder} />
    </>
  ) : null;

  return { getToken, element };
}
