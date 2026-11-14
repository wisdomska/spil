import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { securityHeaders } from "./lib/security/headers";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: false,
  reactStrictMode: true,
  poweredByHeader: false,
  // Lets a second local build (for example a Lighthouse run) sit beside the one being served.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // OG image routes read their fonts from assets/fonts at runtime.
  outputFileTracingIncludes: {
    "/og": ["./assets/fonts/**"],
    "/og/r/[code]": ["./assets/fonts/**"],
  },
  // Deployment storage (owner request 2026-11-14): the share-card routes pulled in sharp and
  // its native image library, about 20 MB per function and over half of all function output.
  // next/og only uses sharp when it happens to load and otherwise renders the PNG with its own
  // bundled resvg, so the cards come out the same without it.
  outputFileTracingExcludes: {
    "*": ["**/node_modules/sharp/**", "**/node_modules/@img/**"],
  },
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
