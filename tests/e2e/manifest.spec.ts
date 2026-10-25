import { expect, test } from "@playwright/test";

// SPIL-30: the app can be installed: a linked manifest with standalone display and icons.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("web app manifest is installable", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();
  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({
    name: "SPIL",
    short_name: "SPIL",
    start_url: "/",
    display: "standalone",
  });
  const sizes = manifest.icons.map(
    (i: { sizes: string; purpose: string }) => `${i.sizes} ${i.purpose}`,
  );
  expect(sizes).toEqual(expect.arrayContaining(["192x192 any", "512x512 any", "512x512 maskable"]));
  for (const icon of manifest.icons as { src: string }[]) {
    const res = await request.get(icon.src);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
  }
});
