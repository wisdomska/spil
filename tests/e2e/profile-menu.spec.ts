import { expect, test } from "@playwright/test";

// Profile menu and profile settings (owner request 2026-10-26).
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("desktop: face and name open a menu that marks the current page", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("spil.profile", JSON.stringify({ nickname: "Senya", avatar: 4 })),
  );
  await page.goto("/badges");
  await page.getByRole("button", { name: "Menu for Senya" }).click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem", { name: "Your badges" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  for (const name of ["Your crews", "Today's Spill", "How to play", "Profile settings"])
    await expect(menu.getByRole("menuitem", { name })).toBeVisible();
  await menu.getByRole("menuitem", { name: "Your crews" }).click();
  await page.waitForURL(/\/crews$/);
});

test("phone: one button opens a side panel; Escape, the close button and a swipe close it", async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  await page.goto("/daily");
  const open = page.getByRole("button", { name: "Menu", exact: true });
  const panel = page.getByRole("dialog", { name: "Menu" });

  await open.click();
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("link", { name: "Today's Spill" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  // Every row is at least 48 px tall.
  for (const link of await panel.getByRole("navigation").getByRole("link").all())
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(open).toBeFocused();

  await open.click();
  await panel.getByRole("button", { name: "Close the menu" }).click();
  await expect(panel).toHaveCount(0);

  await open.click();
  await expect(panel).toBeVisible();
  const box = (await panel.boundingBox())!;
  const y = box.y + box.height - 80;
  await page.mouse.move(box.x + 40, y);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, y, { steps: 8 });
  await page.mouse.move(box.x + 200, y, { steps: 8 });
  await page.mouse.up();
  await expect(panel).toHaveCount(0);

  await open.click();
  await panel.getByRole("link", { name: "How to play" }).click();
  await page.waitForURL(/\/how-to-play$/);
  await context.close();
});

test("profile settings: the saved name and face show in the header, and can be forgotten", async ({
  page,
}) => {
  await page.goto("/profile");
  await page.getByLabel("Nickname").fill("A");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Pick a nickname with 2 to 16 characters.")).toBeVisible();
  await page.getByLabel("Nickname").fill("Kwabena");
  await page.getByRole("radio", { name: "Avatar: Cowboy" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/^Saved\. Your next room/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Menu for Kwabena" })).toBeVisible();

  await page.getByRole("button", { name: "Forget this name and face" }).click();
  await expect(page.getByRole("button", { name: "Menu for Guest" })).toBeVisible();
  await expect(page.getByLabel("Nickname")).toHaveValue("");
});
