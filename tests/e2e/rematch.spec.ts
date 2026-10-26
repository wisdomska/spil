import { expect, test } from "@playwright/test";
import { answerAll, createRoom, guessAll, joinRoom, phone, revealAndSkip } from "./harness";

// SPIL-18: Rematch is one tap with the same pack; the series strip shows from the second round.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("one-tap rematch and the series strip", async ({ browser }) => {
  const host = await phone(browser, "host");
  const guest = await phone(browser, "guest");
  const code = await createRoom(host.page, { pack: "classic", count: 5, nickname: "Ama" });
  await joinRoom(guest.page, code, { nickname: "Esi" });

  for (let round = 1; round <= 2; round++) {
    await host.page.getByRole("button", { name: "Start the game" }).click();
    await answerAll(host.page, "YYYYY");
    await answerAll(guest.page, "NNNNN");
    await guessAll(host.page, 0);
    await guessAll(guest.page, 50);
    await revealAndSkip(host.page, [guest.page]);
    if (round === 1) {
      await expect(host.page.getByText(/^Series/)).toHaveCount(0);
      await expect(guest.page.getByText("Ama can start a rematch")).toBeVisible();
      await host.page.getByRole("button", { name: "Rematch" }).click();
      await expect(host.page.getByRole("region", { name: "Game setup" })).toContainText("Classic");
    }
  }
  const strip = host.page.getByLabel(/^Series after 2 rounds/);
  await expect(strip).toBeVisible();
  await expect(guest.page.getByLabel(/^Series after 2 rounds/)).toBeVisible();
  await host.page.getByRole("button", { name: "Reset series" }).click();
  await expect(host.page.getByText("Series reset.", { exact: false })).toBeVisible();
  await expect(strip).toHaveCount(0);
  await expect(guest.page.getByRole("button", { name: "Reset series" })).toHaveCount(0);
  for (const p of [host, guest]) await p.context.close();
});
