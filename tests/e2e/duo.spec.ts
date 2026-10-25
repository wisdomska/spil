import { expect, test } from "@playwright/test";
import { answerAll, createRoom, guessAll, joinRoom, phone, revealAndSkip } from "./harness";

// SPIL-23: a two-player room shows Scores and Duo, never an empty tab, and a duo group card.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("two players get duo results", async ({ browser }) => {
  const host = await phone(browser, "host");
  const guest = await phone(browser, "guest");
  const code = await createRoom(host.page, { pack: "classic", count: 5, nickname: "Ama" });
  await joinRoom(guest.page, code, { nickname: "Esi" });
  await host.page.getByRole("button", { name: "Start the game" }).click();
  await answerAll(host.page, "YYYYY");
  await answerAll(guest.page, "NNNNN");
  await guessAll(host.page, 0);
  await guessAll(guest.page, 100);
  await revealAndSkip(host.page, [guest.page]);

  const tabs = guest.page.getByRole("tab");
  await expect(tabs).toHaveText(["Scores", "Duo"]);
  await guest.page.getByRole("tab", { name: "Duo" }).click();
  await expect(
    guest.page.getByRole("group", { name: /How well you know each other: 100%/ }),
  ).toBeVisible();
  await expect(guest.page.getByText("Soulmates")).toBeVisible();

  await guest.page.getByRole("button", { name: "Share my card" }).click();
  const sheet = guest.page.getByRole("dialog");
  await sheet.getByText("Group 1:1").click();
  await expect(sheet.getByText("How well we know each other: 100%").first()).toBeAttached();
  await expect(sheet.getByText(/won the round/)).toHaveCount(0);
  for (const p of [host, guest]) await p.context.close();
});
