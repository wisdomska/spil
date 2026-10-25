import { expect, test } from "@playwright/test";
import { passAgeGate, phone } from "./harness";

// Daily Spill: one question a day; answer it and the streak starts on this device.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("anyone can answer today's question and start a streak", async ({ browser }) => {
  const { page, context } = await phone(browser, "guest");
  await page.goto("/");
  await page.getByRole("link", { name: /^Today's Spill/ }).click();
  await passAgeGate(page, 25);
  await expect(page.getByText("TODAY'S SPILL", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Have you ever");
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await expect(page.getByText("You said yes.")).toBeVisible();
  await expect(page.getByText("1 day in a row")).toBeVisible();
  // Coming back the same day shows the answer, not the buttons.
  await page.reload();
  await expect(page.getByText("You said yes.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Yes", exact: true })).toHaveCount(0);
  await context.close();
});
