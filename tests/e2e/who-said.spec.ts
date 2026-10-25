import { expect, test, type Page } from "@playwright/test";
import { createRoom, joinRoom, lockIn, phone } from "./harness";

// Who Said That? (18+): three phones write answers, guess who wrote what, see the authors.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

async function writeAll(page: Page, name: string) {
  for (let i = 0; i < 5; i++) {
    const box = page.getByLabel("Your answer");
    await expect(box).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(`${i + 1}/5`, { exact: true }).first()).toBeVisible();
    await box.fill(`${name} wrote number ${i + 1}`);
    await lockIn(page);
  }
}

async function guessAll(page: Page) {
  await expect(page.getByText(/^Answer 1 of \d+$/)).toBeVisible({ timeout: 30_000 });
  const total = Number((await page.getByText(/^Answer 1 of \d+$/).textContent())!.split(" of ")[1]);
  for (let i = 0; i < total; i++) {
    await expect(page.getByText(`Answer ${i + 1} of ${total}`)).toBeVisible();
    const body = await page.locator("blockquote").innerText();
    const author = body.split(" wrote")[0]!;
    await page.getByRole("radio", { name: new RegExp(author) }).click();
    await lockIn(page);
  }
}

test("players write answers and guess who said what", async ({ browser }) => {
  const host = await phone(browser, "guest");
  const g1 = await phone(browser, "guest");
  const g2 = await phone(browser, "guest");
  const code = await createRoom(host.page, {
    pack: "Who Said That",
    count: 5,
    nickname: "Senya",
    mode: "Who Said That",
  });
  await joinRoom(g1.page, code, { nickname: "Ama" });
  await joinRoom(g2.page, code, { nickname: "Kofi" });
  await host.page.getByRole("button", { name: "Start the game" }).click();

  // The filter refuses contact details before anything is saved.
  await expect(host.page.getByLabel("Your answer")).toBeVisible({ timeout: 15_000 });
  await host.page.getByLabel("Your answer").fill("find me at www.example.com");
  await lockIn(host.page);
  await expect(
    host.page.getByText("No links, emails, numbers or handles in answers."),
  ).toBeVisible();

  await Promise.all([
    writeAll(host.page, "Senya"),
    writeAll(g1.page, "Ama"),
    writeAll(g2.page, "Kofi"),
  ]);
  await Promise.all([guessAll(host.page), guessAll(g1.page), guessAll(g2.page)]);

  await host.page.getByRole("button", { name: "Start the reveal" }).click({ timeout: 20_000 });
  await expect(host.page.getByText("WHO SAID THAT?", { exact: true })).toBeVisible();
  await expect(host.page.getByText("2 of 2 guessed right").first()).toBeVisible({
    timeout: 10_000,
  });

  await host.page.getByRole("button", { name: "Skip" }).click();
  await expect(host.page.getByText("10 of 10 right.")).toBeVisible({ timeout: 15_000 });
  await host.page.getByRole("tab", { name: "Questions" }).click();
  await host.page
    .getByRole("button", { name: /^Report this answer/ })
    .first()
    .click();
  await expect(host.page.getByText("Reported. The answer is hidden for everyone.")).toBeVisible();
  for (const p of [host, g1, g2]) await p.context.close();
});
