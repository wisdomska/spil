import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// API integration tests: run against a live app (API_BASE_URL) and its Supabase project.
// Locally the Supabase URL and anon key come from .env.local; CI sets them as env vars.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    // Generous: from far-away dev machines every query is a long round trip.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
