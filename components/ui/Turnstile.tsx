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

/** Tokens live 300 s at Cloudflare; use a prefetched one only while it has a safe margin left. */
const TOKEN_TTL_MS = 240_000;

/**
 * Invisible Cloudflare Turnstile. The check runs in the background as soon as the page is ready,
 * so `getToken()` usually returns at once; after a token is used the next one is fetched quietly.
 * Resolves undefined when no site key is configured (local and CI), in which case the server also
 * skips verification.
 */
export function useTurnstile() {
  const holder = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const ready = useRef<{ token: string; at: number } | null>(null);
  const running = useRef(false);
  const waiters = useRef<Array<(token: string | undefined) => void>>([]);

  const run = useCallback(() => {
    if (!widget.current || !window.turnstile || running.current) return;
    running.current = true;
    window.turnstile.reset(widget.current);
    window.turnstile.execute(widget.current);
  }, []);

  const render = useCallback(() => {
    if (!SITE_KEY || !holder.current || !window.turnstile || widget.current) return;
    widget.current = window.turnstile.render(holder.current, {
      sitekey: SITE_KEY,
      size: "invisible",
      execution: "execute",
      appearance: "interaction-only",
      callback: (token: string) => {
        running.current = false;
        const waiting = waiters.current.splice(0);
        if (waiting.length) waiting.forEach((resolve) => resolve(token));
        else ready.current = { token, at: Date.now() };
      },
      "error-callback": () => {
        running.current = false;
        waiters.current.splice(0).forEach((resolve) => resolve(undefined));
      },
      "expired-callback": () => {
        ready.current = null;
      },
    });
    run();
  }, [run]);

  useEffect(render, [render]);

  const getToken = useCallback(async (): Promise<string | undefined> => {
    if (!SITE_KEY) return undefined;
    render();
    if (!window.turnstile || !widget.current) return undefined;
    const cached = ready.current;
    ready.current = null;
    if (cached && Date.now() - cached.at < TOKEN_TTL_MS) {
      // Tokens are single use: start on the next one now, in case this request is retried.
      setTimeout(run, 0);
      return cached.token;
    }
    return new Promise((resolve) => {
      waiters.current.push(resolve);
      run();
      setTimeout(() => resolve(undefined), 15_000);
    });
  }, [render, run]);

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
