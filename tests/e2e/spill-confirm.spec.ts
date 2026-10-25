import { expect, test } from "@playwright/test";
import { answerAll, createRoom, phone, revealAndSkip } from "./harness";

// SPIL-16: turning Spill Mode on asks first, turning it off never does, and the page stays put.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("Spill Mode asks before it turns on", async ({ browser }) => {
  const { page, context } = await phone(browser, "guest");
  await createRoom(page, { pack: "classic", count: 5, nickname: "Senya" });
  await page.getByRole("button", { name: "Play solo" }).click();
  await answerAll(page, "YYNNY");
  await revealAndSkip(page);

  await page.getByRole("tab", { name: "Questions" }).click();
  const spill = page.getByRole("switch", { name: /Spill Mode/ });
  await spill.scrollIntoViewIfNeeded();
  const top = await page.evaluate(() => window.scrollY);

  // Keep private: nothing changes, and focus started there.
  await spill.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Turn on Spill Mode?")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Keep private" })).toBeFocused();
  await dialog.getByRole("button", { name: "Keep private" }).click();
  await expect(spill).toHaveAttribute("aria-checked", "false");

  // Spill it: on, with the toast, and no scroll jump.
  await spill.click();
  await page.getByRole("dialog").getByRole("button", { name: "Spill it" }).click();
  await expect(page.getByText("Spill Mode on.", { exact: false })).toBeVisible();
  await expect(spill).toHaveAttribute("aria-checked", "true");
  await page.waitForTimeout(1500);
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - top)).toBeLessThan(4);

  // Off never asks.
  await spill.click();
  await expect(page.getByText("Spill Mode off.", { exact: false })).toBeVisible();
  await expect(page.getByText("Turn on Spill Mode?")).toHaveCount(0);
  await expect(spill).toHaveAttribute("aria-checked", "false");
  await context.close();
});
