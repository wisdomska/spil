import { expect, test, type Page } from "@playwright/test";
import { answerAll, createRoom, joinRoom, lockIn, phone } from "./harness";

// Two Truths and a Spill: answer, pick a card from your own answers, spot the spills.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

async function pickCard(page: Page) {
  await expect(page.getByText("Two truths and a spill.")).toBeVisible({ timeout: 15_000 });
  const truths = page.getByRole("checkbox");
  await truths.nth(0).click();
  await truths.nth(1).click();
  await page.getByRole("radio").first().click();
  await page.getByRole("button", { name: "Lock in my card" }).click();
}

async function spotAll(page: Page, cards: number) {
  for (let i = 0; i < cards; i++) {
    await expect(page.getByText(`Card ${i + 1} of ${cards}`)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("radio").first().click();
    await lockIn(page);
  }
}

test("players show two truths and a spill and spot each other's", async ({ browser }) => {
  const host = await phone(browser, "guest");
  const g1 = await phone(browser, "guest");
  const g2 = await phone(browser, "guest");
  const code = await createRoom(host.page, {
    pack: "classic",
    count: 5,
    nickname: "Senya",
    mode: "Two Truths and a Spill",
  });
  await joinRoom(g1.page, code, { nickname: "Ama" });
  await joinRoom(g2.page, code, { nickname: "Kofi" });
  await host.page.getByRole("button", { name: "Start the game" }).click();

  await Promise.all([
    answerAll(host.page, "YYNYN"),
    answerAll(g1.page, "YYNYN"),
    answerAll(g2.page, "YYYYY"),
  ]);
  await Promise.all([pickCard(host.page), pickCard(g1.page)]);
  // Kofi said yes to everything: no card, but still plays.
  await expect(g2.page.getByText("Not enough for a card this round.")).toBeVisible({
    timeout: 15_000,
  });
  await g2.page.getByRole("button", { name: "Continue" }).click();

  await Promise.all([spotAll(host.page, 1), spotAll(g1.page, 1), spotAll(g2.page, 2)]);

  await host.page.getByRole("button", { name: "Start the reveal" }).click({ timeout: 20_000 });
  await expect(host.page.getByText("Spill", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(host.page.getByText("True", { exact: true }).first()).toBeVisible();

  await host.page.getByRole("button", { name: "Skip" }).click();
  await expect(host.page.getByText("YOUR CARD FOOLED")).toBeVisible({ timeout: 15_000 });
  await expect(g2.page.getByText("No card this round.")).toBeVisible({ timeout: 15_000 });
  for (const p of [host, g1, g2]) await p.context.close();
});
