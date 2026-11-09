// Security headers (spec section 18). Static so pages stay prerendered and edge cached; see
// docs/DECISIONS.md for why the CSP allows inline scripts instead of per-request nonces.

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
// http becomes ws for a local Supabase, https becomes wss everywhere else.
const supabaseWs = supabase.replace(/^http/, "ws");
const posthog = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";
const isDev = process.env.NODE_ENV !== "production";
// Vercel injects its feedback toolbar into preview deployments (staging, PR previews), never
// production. Allow it there so it does not log CSP errors.
const toolbar = process.env.VERCEL_ENV === "preview";
const live = toolbar ? ["https://vercel.live"] : [];

export function contentSecurityPolicy() {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      ...(isDev ? ["'unsafe-eval'"] : []),
      "https://challenges.cloudflare.com",
      "https://va.vercel-scripts.com",
      "https://*.posthog.com",
      ...live,
    ],
    "style-src": ["'self'", "'unsafe-inline'", ...live],
    "img-src": ["'self'", "data:", "blob:", ...live, ...(toolbar ? ["https://vercel.com"] : [])],
    "font-src": ["'self'", "data:", ...live, ...(toolbar ? ["https://assets.vercel.com"] : [])],
    "connect-src": [
      "'self'",
      // Dev only: the HMR websocket ('self' does not cover ws: in every browser).
      ...(isDev ? ["ws://localhost:*", "ws://127.0.0.1:*"] : []),
      supabase,
      supabaseWs,
      posthog,
      "https://*.posthog.com",
      "https://*.ingest.sentry.io",
      "https://*.ingest.de.sentry.io",
      "https://vitals.vercel-insights.com",
      "https://challenges.cloudflare.com",
      ...live,
      ...(toolbar ? ["wss://ws-us3.pusher.com"] : []),
    ].filter(Boolean),
    "frame-src": ["https://challenges.cloudflare.com", ...live],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    // Vercel serves only HTTPS. Local production builds run on http://localhost, which WebKit would
    // also upgrade (Chrome exempts localhost), breaking every script and stylesheet.
    ...(process.env.VERCEL ? { "upgrade-insecure-requests": [] } : {}),
  };
  return Object.entries(directives)
    .map(([k, v]) => [k, ...v].join(" "))
    .join("; ");
}

export const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];
