import { expect, test } from "@playwright/test";
import { createRoom, phone } from "./harness";

// SPIL-20: skips left are always visible, and going back shows what I said.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("skip count and answered state on back", async ({ browser }) => {
  const { page, context } = await phone(browser, "guest");
  await createRoom(page, { pack: "classic", count: 10, nickname: "Senya" });
  await page.getByRole("button", { name: "Play solo" }).click();

  const card = (n: number) => page.getByRole("group", { name: new RegExp(`^Question ${n} of 10`) });
  await expect(card(1)).toBeVisible();
  await expect(page.getByRole("button", { name: /1 skip left/ })).toHaveText("Skip · 1 left");
  await page.keyboard.press("y");
  await expect(card(2)).toBeVisible();
  await page.getByRole("button", { name: /1 skip left/ }).click();
  await expect(card(3)).toBeVisible();
  const none = page.getByRole("button", { name: "No skips left" });
  await expect(none).toHaveAttribute("aria-disabled", "true");
  // aria-disabled stays tappable, so the reason can be shown.
  await none.click({ force: true });
  await expect(page.getByText("You've used all your skips for this round.")).toBeVisible();
  await expect(card(3)).toBeVisible();

  await page.getByRole("button", { name: "Previous question" }).click();
  await expect(card(2)).toContainText("Skipped");
  await page.getByRole("button", { name: "Previous question" }).click();
  await expect(card(1)).toContainText("You said Yes");
  await expect(page.getByRole("button", { name: "Yes", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "No", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await context.close();
});
