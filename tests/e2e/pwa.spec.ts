import { expect, test } from "@playwright/test";
import { createRoom, phone } from "./harness";

// Installed app and push notifications (owner request 2026-11-23, modelled on Clink).
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("the manifest and iPhone tags describe an installable app", async ({ page, request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ id: "/", display: "standalone", start_url: "/?source=pwa" });
  expect(
    manifest.icons.map((i: { purpose: string; sizes: string }) => `${i.purpose} ${i.sizes}`),
  ).toEqual(expect.arrayContaining(["maskable 192x192", "maskable 512x512", "any 512x512"]));
  expect(manifest.shortcuts.map((s: { url: string }) => s.url)).toEqual([
    "/create?source=pwa",
    "/join?source=pwa",
    "/daily?source=pwa",
  ]);

  await page.goto("/");
  await expect(
    page
      .locator('meta[name="apple-mobile-web-app-capable"], meta[name="mobile-web-app-capable"]')
      .first(),
  ).toHaveAttribute("content", "yes");
  await expect(page.locator('link[rel="apple-touch-startup-image"]')).toHaveCount(13);
  const splash = await page
    .locator('link[rel="apple-touch-startup-image"]')
    .first()
    .getAttribute("href");
  expect((await request.get(splash!)).headers()["content-type"]).toContain("image/png");
  const sw = await request.get("/sw.js");
  expect(sw.headers()["cache-control"]).toContain("no-cache");
});

test("the service worker serves public pages and the offline page without a connection", async ({
  browser,
}) => {
  const { context, page } = await phone(browser, "host");
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("spil.sw", "1"));
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, {
    timeout: 15_000,
  });
  // Visited online once, so its copy is kept for offline.
  await page.goto("/faq");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await context.setOffline(true);
  await page.goto("/faq");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // A room is never cached: offline shows SPIL's own page, not the browser's.
  await page.goto("/r/ZZZZ");
  await expect(page.getByRole("heading", { name: "You're offline." })).toBeVisible();
  await context.setOffline(false);
  await context.close();
});

test("the install guide shows the steps for the chosen device", async ({ page }) => {
  await page.goto("/install");
  await expect(page.getByRole("heading", { name: "Put SPIL on your home screen" })).toBeVisible();
  await page.getByRole("tab", { name: "iPhone" }).click();
  await expect(page.getByText("Tap Share, then Add to Home Screen")).toBeVisible();
  await page.getByRole("tab", { name: "Android" }).click();
  await expect(page.getByText("Tap the three dots, then Install app")).toBeVisible();
  await page.getByRole("tab", { name: "Computer" }).click();
  await expect(page.getByText("Open SPIL in Chrome or Edge")).toBeVisible();
});

test("a device can save, change and drop its notification choices", async ({ browser }) => {
  const { context, page } = await phone(browser, "guest");
  await createRoom(page, { pack: "classic", count: 10, nickname: "Pusher" });
  const endpoint = `https://push.example/${Date.now()}`;
  const keys = { p256dh: "B".repeat(87), auth: "A".repeat(22) };

  const saved = await page.request.post("/api/v1/push", { data: { endpoint, keys } });
  expect(saved.status()).toBe(200);
  expect(await saved.json()).toEqual({ gameUpdates: true, daily: true });

  const changed = await page.request.patch("/api/v1/push", { data: { endpoint, daily: false } });
  expect(await changed.json()).toEqual({ gameUpdates: true, daily: false });
  const read = await page.request.get(`/api/v1/push?endpoint=${encodeURIComponent(endpoint)}`);
  expect(await read.json()).toEqual({ gameUpdates: true, daily: false });

  await page.request.delete("/api/v1/push", { data: { endpoint } });
  const gone = await page.request.get(`/api/v1/push?endpoint=${encodeURIComponent(endpoint)}`);
  expect(gone.status()).toBe(404);
  await context.close();
});
