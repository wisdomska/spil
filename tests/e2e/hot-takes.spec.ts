import { expect, test, type Page } from "@playwright/test";
import { createRoom, guess, joinRoom, lockIn, phone } from "./harness";

// Hot Takes: three phones rate statements in private, then guess the room's average.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

async function rateAll(page: Page, value: number) {
  for (let i = 0; i < 5; i++) {
    await expect(
      page.getByRole("slider", { name: new RegExp(`^Statement ${i + 1} of 5\\.`) }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("How much do you agree?")).toBeVisible();
    await guess(page, value);
    await lockIn(page);
  }
}

async function guessAverages(page: Page, value: number) {
  await expect(page.getByText("What's the room's average?")).toBeVisible({ timeout: 15_000 });
  for (let i = 0; i < 5; i++) {
    await expect(page.getByText(`Take ${i + 1} of 5`)).toBeVisible();
    await guess(page, value);
    await lockIn(page);
  }
}

test("three players rate hot takes and guess the room's average", async ({ browser }) => {
  const host = await phone(browser, "guest");
  const g1 = await phone(browser, "guest");
  const g2 = await phone(browser, "guest");
  const code = await createRoom(host.page, {
    pack: "Hot Takes",
    count: 5,
    nickname: "Senya",
    mode: "Hot Takes",
  });
  await expect(host.page.getByRole("region", { name: "Game setup" })).toContainText("Hot Takes");
  await joinRoom(g1.page, code, { nickname: "Ama" });
  await joinRoom(g2.page, code, { nickname: "Kofi" });
  await host.page.getByRole("button", { name: "Start the game" }).click();

  // Every statement averages 50: 80, 60 and 10.
  await Promise.all([rateAll(host.page, 80), rateAll(g1.page, 60), rateAll(g2.page, 10)]);
  await Promise.all([
    guessAverages(host.page, 50),
    guessAverages(g1.page, 70),
    guessAverages(g2.page, 20),
  ]);

  await host.page.getByRole("button", { name: "Start the reveal" }).click();
  await expect(host.page.getByText("TAKE 1 OF 5")).toBeVisible();
  await expect(host.page.getByText("Room average 50")).toBeVisible({ timeout: 8000 });
  await expect(host.page.getByText("Bullseye")).toBeVisible();

  await host.page.getByRole("button", { name: "Skip" }).click();
  await expect(host.page.getByText("YOUR HOTTEST TAKE")).toBeVisible({ timeout: 15_000 });
  await expect(host.page.getByText(/You said 80\. The room averaged 50\./)).toBeVisible();
  await expect(host.page.getByText(/You read the room for 65 points\./)).toBeVisible();
  await expect(host.page.getByRole("button", { name: "Share my card" })).toHaveCount(0);
  await expect(g2.page.getByText(/You said 10\. The room averaged 50\./)).toBeVisible({
    timeout: 15_000,
  });
  for (const p of [host, g1, g2]) await p.context.close();
});
