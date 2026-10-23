import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

/** Design parity run (tests/visual). Needs the app on E2E_BASE_URL and /design served on DESIGN_URL. */
export default defineConfig({
  testDir: "tests/visual",
  testMatch: /parity\.spec\.ts/,
  timeout: 120_000,
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", actionTimeout: 20_000 },
});
