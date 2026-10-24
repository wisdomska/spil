import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

/** Baseline screenshots for the QA matrix (tests/visual/baseline.spec.ts). Chromium only. */
export default defineConfig({
  testDir: "tests/visual",
  testMatch: /baseline\.spec\.ts/,
  timeout: 180_000,
  workers: 4,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    reducedMotion: "reduce",
    actionTimeout: 20_000,
  },
});
