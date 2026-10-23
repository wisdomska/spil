"use client";

import type { PostHog } from "posthog-js";
import type { AnalyticsEvent, AnalyticsEvents } from "./events";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

let client: Promise<PostHog | null> | null = null;

/**
 * Loads PostHog after the page is interactive, only when a key is configured. Memory persistence
 * and no autocapture: no cookies, no form contents, so no consent banner is needed.
 */
function load() {
  if (!KEY || typeof window === "undefined") return Promise.resolve(null);
  client ??= import("posthog-js").then(({ default: posthog }) => {
    posthog.init(KEY, {
      api_host: HOST,
      persistence: "memory",
      autocapture: false,
      capture_pageview: true,
      capture_pageleave: false,
      disable_session_recording: true,
      ip: false,
      sanitize_properties: (props) => {
        // Belt and braces: never ship answer or question content.
        for (const k of Object.keys(props))
          if (/answer|guess|question_text/i.test(k)) delete props[k];
        return props;
      },
    });
    return posthog;
  });
  return client;
}

export function track<E extends AnalyticsEvent>(event: E, props: AnalyticsEvents[E]) {
  void load().then((ph) => ph?.capture(event, props));
}

export function initAnalytics() {
  void load();
}
