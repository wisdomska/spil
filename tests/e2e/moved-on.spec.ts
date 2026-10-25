import { expect, test } from "@playwright/test";
import { answerAll, answerSome, createRoom, joinRoom, phone } from "./harness";

// SPIL-15: the player the host moved on without is told why, and the roster says "Sat out".
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("a moved-on player sees why before guessing", async ({ browser }) => {
  const host = await phone(browser, "host");
  const guest = await phone(browser, "guest");
  const code = await createRoom(host.page, { pack: "classic", count: 5, nickname: "Ama" });
  await joinRoom(guest.page, code, { nickname: "Esi" });
  await host.page.getByRole("button", { name: "Start the game" }).click();

  await answerSome(guest.page, 2);
  await answerAll(host.page, "YN");
  await host.page.getByRole("button", { name: "Move on without them" }).click();
  await host.page.getByRole("dialog").getByRole("button", { name: "Move on without them" }).click();

  const sheet = guest.page.getByRole("dialog");
  await expect(sheet.getByText("The host moved on.")).toBeVisible();
  await expect(sheet).toContainText("you can still guess");
  await sheet.getByRole("button", { name: "Got it" }).click();
  await expect(guest.page.getByText("The host moved on.")).toHaveCount(0);
  await expect(guest.page.getByText(/^Guess 1 of/)).toBeVisible();

  // The host's roster says Esi sat out, and a reload does not bring the sheet back.
  await expect(host.page.getByText("Sat out").first()).toBeVisible();
  await guest.page.reload();
  await expect(guest.page.getByText(/^Guess 1 of/)).toBeVisible();
  await expect(guest.page.getByText("The host moved on.")).toHaveCount(0);
  for (const p of [host, guest]) await p.context.close();
});
