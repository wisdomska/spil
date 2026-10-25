import { expect, test } from "@playwright/test";

// SPIL-32: the header keeps its place between short and long pages.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("header does not shift between pages", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const boxes: Array<{ x: number; width: number }> = [];
  for (const path of ["/", "/join", "/create"]) {
    await page.goto(path);
    const header = page.locator("header").first();
    await expect(header).toBeVisible();
    const box = (await header.boundingBox())!;
    boxes.push({ x: Math.round(box.x), width: Math.round(box.width) });
  }
  expect(boxes[1]).toEqual(boxes[0]);
  expect(boxes[2]).toEqual(boxes[0]);
});
