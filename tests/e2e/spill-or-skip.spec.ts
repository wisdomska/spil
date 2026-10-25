import { expect, test } from "@playwright/test";
import { answerAll, createRoom, guessAll, joinRoom, phone, revealAndSkip } from "./harness";

// Spill or Skip: a classic round, then the room votes for one Spill Mode story.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("the room votes for a story and the picked player tells it", async ({ browser }) => {
  const host = await phone(browser, "guest");
  const g1 = await phone(browser, "guest");
  const g2 = await phone(browser, "guest");
  const code = await createRoom(host.page, {
    pack: "classic",
    count: 5,
    nickname: "Senya",
    mode: "Spill or Skip",
  });
  await joinRoom(g1.page, code, { nickname: "Ama" });
  await joinRoom(g2.page, code, { nickname: "Kofi" });
  await host.page.getByRole("button", { name: "Start the game" }).click();
  await Promise.all([
    answerAll(host.page, "YYYYY"),
    answerAll(g1.page, "NNNNN"),
    answerAll(g2.page, "NNNNN"),
  ]);
  await Promise.all([guessAll(host.page, 50), guessAll(g1.page, 50), guessAll(g2.page, 50)]);
  await revealAndSkip(host.page, [g1.page, g2.page]);

  await expect(g1.page.getByText("Nobody is in Spill Mode yet.", { exact: false })).toBeVisible();
  // Senya opens up their answers; the room can now pick one of their yeses.
  await host.page.getByRole("switch", { name: /Spill Mode/ }).click();
  for (const g of [g1, g2]) {
    const option = g.page.getByRole("radio", { name: /^Senya: Have you ever/ }).first();
    await expect(option).toBeVisible({ timeout: 15_000 });
    await option.click();
    await g.page.getByRole("button", { name: "Vote", exact: true }).click();
  }
  await expect(host.page.getByText(/^The room wants your story/)).toBeVisible({ timeout: 15_000 });
  await host.page.getByRole("button", { name: "I'll tell it" }).click();
  await expect(g1.page.getByText("Senya is telling the story.")).toBeVisible({ timeout: 15_000 });
  for (const p of [host, g1, g2]) await p.context.close();
});
