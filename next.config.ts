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
