import { expect, test } from "@playwright/test";
import { answerAll, createRoom, guessAll, joinRoom, phone } from "./harness";

// Live reactions: a tap on one phone floats up on the others during the reveal.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("a reaction on one phone shows on the other during the reveal", async ({ browser }) => {
  const host = await phone(browser, "host");
  const guest = await phone(browser, "guest");
  const code = await createRoom(host.page, { pack: "classic", count: 5, nickname: "Ama" });
  await joinRoom(guest.page, code, { nickname: "Kwame" });
  await host.page.getByRole("button", { name: /^(Start the game|Play solo)$/ }).click();
  await Promise.all([answerAll(host.page, "YYYYN"), answerAll(guest.page, "NNYNN")]);
  await Promise.all([guessAll(host.page, 30), guessAll(guest.page, 70)]);
  await host.page.getByRole("button", { name: "Start the reveal" }).click();
  await expect(guest.page.getByText("REVEAL 1 OF 2")).toBeVisible();

  await guest.page.getByRole("button", { name: "React with 🔥" }).click();
  // It floats on the sender straight away and reaches the other phone over the room channel.
  await expect(guest.page.locator("span").filter({ hasText: /^🔥$/ })).toHaveCount(1);
  await expect(host.page.locator("span").filter({ hasText: /^🔥$/ })).toHaveCount(1, {
    timeout: 8000,
  });
  await host.context.close();
  await guest.context.close();
});
