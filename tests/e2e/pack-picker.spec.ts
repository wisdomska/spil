import { expect, test, type Page } from "@playwright/test";
import { passAgeGate, phone } from "./harness";

// SPIL-08: sticky Continue, one selected tile, previews. Phone size, runs once.
test.describe.configure({ mode: "serial" });
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

async function inViewport(page: Page, name: RegExp) {
  const box = await page.getByRole("button", { name }).boundingBox();
  const vp = page.viewportSize()!;
  return Boolean(box && box.y >= 0 && box.y + box.height <= vp.height);
}

test("Continue is always on screen at 375 x 812 (SPIL-08)", async ({ browser }) => {
  const { page, context } = await phone(browser, "guest");
  await page.goto("/create");
  await passAgeGate(page, 30);
  await expect(page.getByRole("button", { name: /^Continue with/ })).toBeVisible();
  expect(await inViewport(page, /^Continue with/)).toBe(true);
  await page.mouse.wheel(0, 2000);
  await page.waitForTimeout(300);
  expect(await inViewport(page, /^Continue with/)).toBe(true);
  await expect(page.getByRole("radio", { name: "10", exact: true })).toBeChecked();
  await context.close();
});

test("only the chosen tile looks selected; preview picks a pack (SPIL-08)", async ({ browser }) => {
  const { page, context } = await phone(browser, "guest");
  await page.goto("/create");
  await passAgeGate(page, 30);
  const packs = page.getByRole("radiogroup", { name: "Question pack" }).getByRole("radio");
  await page.getByRole("radio", { name: /Group Chat/ }).click();
  await expect(packs.and(page.locator("[aria-checked='true']"))).toHaveCount(1);
  await expect(page.getByRole("radio", { name: /Group Chat/ })).toBeChecked();
  await expect(page.getByRole("radio", { name: /Classic/ })).not.toBeChecked();

  await page.getByRole("button", { name: "Preview After Dark" }).click();
  const sheet = page.getByRole("dialog", { name: "After Dark" });
  await expect(sheet.getByText("Have you ever")).toHaveCount(3);
  await expect(sheet.getByRole("img", { name: /Spice: \d of 5/ })).toBeVisible();
  await sheet.getByRole("button", { name: "Pick After Dark" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("radio", { name: /After Dark/ })).toBeChecked();
  await expect(page.getByRole("button", { name: "Continue with After Dark" })).toBeVisible();
  await context.close();
});

test("a minor cannot preview an adult pack through the API (SPIL-08)", async ({ request }) => {
  const res = await request.get("/api/v1/packs/afterdark/preview?band=16_17");
  expect(res.status()).toBe(409);
  const ok = await request.get("/api/v1/packs/classic/preview?band=13_15");
  expect((await ok.json()).questions).toHaveLength(3);
});
