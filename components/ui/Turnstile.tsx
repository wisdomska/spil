"use client";

import { useTranslations } from "next-intl";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  execute: (id: string) => void;
  reset: (id: string) => void;
  remove: (id: string) => void;
  getResponse: (id: string) => string | undefined;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** Tokens live 300 s at Cloudflare; use a prefetched one only while it has a safe margin left. */
const TOKEN_TTL_MS = 240_000;
/** SPIL-05: Continue waits this long for a token, then shows the visible check instead. */
const TOKEN_WAIT_MS = 5_000;

/**
 * Cloudflare Turnstile. It runs invisibly as soon as the page is ready, so `getToken()` usually
 * returns at once. When Cloudflare wants a person to interact, or a token is refused, the check
 * moves into a visible "Quick check" card (`challenge`) that the caller shows above its button
 * (SPIL-05). `getToken()` resolves undefined when there is no token yet; callers never submit
 * then. With no site key configured (local and CI) it resolves "" and the server skips the check.
 */
export function useTurnstile() {
  const t = useTranslations("common");
  const holder = useRef<HTMLDivElement>(null);
  const visibleHolder = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const ready = useRef<{ token: string; at: number } | null>(null);
  const running = useRef(false);
  const waiters = useRef<Array<(token: string | undefined) => void>>([]);
  const [needsInteraction, setNeedsInteraction] = useState(false);

  const deliver = useCallback((token: string) => {
    running.current = false;
    const waiting = waiters.current.splice(0);
    if (waiting.length) waiting.forEach((resolve) => resolve(token));
    else ready.current = { token, at: Date.now() };
  }, []);

  const fail = useCallback(() => {
    running.current = false;
    waiters.current.splice(0).forEach((resolve) => resolve(undefined));
    setNeedsInteraction(true);
  }, []);

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
      callback: deliver,
      "error-callback": fail,
      "expired-callback": () => {
        ready.current = null;
      },
    });
    run();
  }, [deliver, fail, run]);

  useEffect(render, [render]);

  // Visible check: replaces the invisible widget so the person can finish a challenge.
  useEffect(() => {
    if (!needsInteraction || !SITE_KEY || !window.turnstile || !visibleHolder.current) return;
    if (widget.current) window.turnstile.remove(widget.current);
    running.current = false;
    widget.current = window.turnstile.render(visibleHolder.current, {
      sitekey: SITE_KEY,
      size: "flexible",
      appearance: "always",
      callback: deliver,
      "error-callback": () => {
        running.current = false;
        waiters.current.splice(0).forEach((resolve) => resolve(undefined));
      },
      "expired-callback": () => {
        ready.current = null;
      },
    });
  }, [needsInteraction, deliver]);

  const getToken = useCallback(async (): Promise<string | undefined> => {
    if (!SITE_KEY) return "";
    render();
    if (!window.turnstile || !widget.current) return undefined;
    const cached = ready.current;
    ready.current = null;
    if (cached && Date.now() - cached.at < TOKEN_TTL_MS) {
      // Tokens are single use: start on the next one now, in case this request is retried.
      if (!needsInteraction) setTimeout(run, 0);
      return cached.token;
    }
    return new Promise((resolve) => {
      waiters.current.push(resolve);
      if (!needsInteraction) run();
      setTimeout(() => {
        waiters.current = waiters.current.filter((w) => w !== resolve);
        resolve(undefined);
      }, TOKEN_WAIT_MS);
    });
  }, [render, run, needsInteraction]);

  /** The server refused the token: ask the person to finish a visible check. */
  const showChallenge = useCallback(() => setNeedsInteraction(true), []);

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

  const challenge =
    SITE_KEY && needsInteraction ? (
      <div className="grid gap-2.5 rounded-card border border-line bg-surface p-4">
        <span className="text-[14px] leading-none font-semibold">{t("quickCheck")}</span>
        <div ref={visibleHolder} className="min-h-[65px]" />
      </div>
    ) : null;

  return { getToken, element, challenge, showChallenge, needsInteraction };
}
