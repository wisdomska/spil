import { expect, test, type Page } from "@playwright/test";
import { createRoom, joinRoom, phone } from "./harness";

// Red Flag, Green Flag: three phones swipe in private; the reveal shows the room's split.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

async function swipeAll(page: Page, key: "y" | "n") {
  for (let i = 0; i < 5; i++) {
    await expect(
      page.getByRole("group", { name: new RegExp(`^Scenario ${i + 1} of 5\\.`) }),
    ).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press(key);
  }
}

test("three players swipe scenarios and see the split", async ({ browser }) => {
  const host = await phone(browser, "guest");
  const g1 = await phone(browser, "guest");
  const g2 = await phone(browser, "guest");
  const code = await createRoom(host.page, {
    pack: "Red Flag, Green Flag",
    count: 5,
    nickname: "Senya",
    mode: "Red Flag, Green Flag",
  });
  await joinRoom(g1.page, code, { nickname: "Ama" });
  await joinRoom(g2.page, code, { nickname: "Kofi" });
  await host.page.getByRole("button", { name: "Start the game" }).click();

  await expect(host.page.getByText("Green flag or red flag?")).toBeVisible({ timeout: 15_000 });
  await expect(host.page.getByRole("button", { name: "Green flag" })).toBeVisible();
  // Green, green, red on every scenario.
  await Promise.all([swipeAll(host.page, "y"), swipeAll(g1.page, "y"), swipeAll(g2.page, "n")]);

  // No guessing: Lights down straight away.
  await host.page.getByRole("button", { name: "Start the reveal" }).click({ timeout: 20_000 });
  await expect(host.page.getByText("SCENARIO 1 OF 5")).toBeVisible();
  await expect(host.page.getByText("Green flag", { exact: true })).toBeVisible({ timeout: 8000 });
  await expect(host.page.getByText("67% green, 33% red")).toBeVisible({ timeout: 8000 });

  await host.page.getByRole("button", { name: "Skip" }).click();
  await expect(g2.page.getByText("YOUR LONE FLAG")).toBeVisible({ timeout: 15_000 });
  await expect(g2.page.getByText(/You said red\. 67% of the room said green\./)).toBeVisible();
  await expect(
    host.page.getByText("You were in step with the room on every scenario."),
  ).toBeVisible({ timeout: 15_000 });
  await expect(host.page.getByText(/in step with the room for 50 points\./)).toBeVisible();
  for (const p of [host, g1, g2]) await p.context.close();
});
