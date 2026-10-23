import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Local runs read Supabase settings from .env.local; CI provides them as env vars.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/**
 * Projects (spec section 19 and the QA brief):
 * - mobile 390x844 and desktop 1280x800 on Chromium run every spec;
 * - cross-browser projects run the specs tagged @cross (Moto G4 Chrome, iPhone Safari/WebKit,
 *   desktop Firefox and Edge).
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "moto-g4",
      grep: /@cross/,
      use: { ...devices["Moto G4"] },
    },
    {
      name: "iphone-webkit",
      grep: /@cross/,
      use: { ...devices["iPhone 13"] },
    },
    {
      name: "firefox",
      grep: /@cross/,
      use: { ...devices["Desktop Firefox"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "edge",
      grep: /@cross/,
      use: {
        ...devices["Desktop Edge"],
        channel: "msedge",
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
});
