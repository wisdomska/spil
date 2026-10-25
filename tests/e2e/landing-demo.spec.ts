import { expect, test, type Page } from "@playwright/test";

// SPIL-22: decorations never cover a tap target; the weekly counter follows its floor.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

type Box = { x: number; y: number; width: number; height: number };
const gap = (a: Box, b: Box) =>
  Math.max(
    b.x - (a.x + a.width),
    a.x - (b.x + b.width),
    b.y - (a.y + a.height),
    a.y - (b.y + b.height),
  );

async function checkClear(page: Page) {
  const slider = page.getByRole("slider").first();
  const reveal = page.getByRole("button", { name: "Reveal the score" });
  const stickers = [page.getByTestId("demo-you"), page.getByTestId("demo-label")];
  // Lowest and highest liquid: the label sticker rides the liquid line.
  for (const key of ["End", "Home"]) {
    await slider.focus();
    await page.keyboard.press(key);
    const target = (await reveal.boundingBox())!;
    for (const s of stickers) {
      const box = (await s.boundingBox())!;
      expect(gap(box, target), `${key}: sticker clear of Reveal`).toBeGreaterThanOrEqual(12);
    }
  }
}

test("landing decorations stay clear of buttons", async ({ page }) => {
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("slider").first()).toBeVisible();
    await checkClear(page);
  }
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sideways).toBeLessThanOrEqual(0);
});

test("weekly rooms counter shows only from 50", async ({ page, request }) => {
  const res = await request.get("/api/v1/stats/public");
  expect(res.headers()["cache-control"]).toContain("s-maxage=600");
  const { roomsThisWeek } = (await res.json()) as { roomsThisWeek: number };
  expect(typeof roomsThisWeek).toBe("number");
  await page.goto("/");
  const line = page.getByText(/rooms spilled this week/);
  if (roomsThisWeek >= 50) await expect(line).toBeVisible();
  else await expect(line).toHaveCount(0);
});
