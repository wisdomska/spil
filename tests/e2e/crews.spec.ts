import { expect, test } from "@playwright/test";
import { answerAll, createRoom, guessAll, joinRoom, phone, revealAndSkip } from "./harness";

// Crews: the host saves the group after a game; a friend joins from the results.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("a group becomes a crew with a season table", async ({ browser }) => {
  const host = await phone(browser, "host");
  const guest = await phone(browser, "guest");
  const code = await createRoom(host.page, { pack: "classic", count: 5, nickname: "Ama" });
  await joinRoom(guest.page, code, { nickname: "Kwame" });
  await host.page.getByRole("button", { name: /^(Start the game|Play solo)$/ }).click();
  await Promise.all([answerAll(host.page, "YYYYN"), answerAll(guest.page, "NNYNN")]);
  await Promise.all([guessAll(host.page, 30), guessAll(guest.page, 70)]);
  await revealAndSkip(host.page, [guest.page]);

  await host.page.getByRole("button", { name: "Save as a crew" }).click();
  await host.page.getByLabel("Crew name").fill("Osu Squad");
  await host.page.getByRole("button", { name: "Save crew" }).click();
  await expect(host.page.getByText("Playing as Osu Squad")).toBeVisible();

  await expect(guest.page.getByRole("button", { name: "Join Osu Squad" })).toBeVisible({
    timeout: 15_000,
  });
  await guest.page.getByRole("button", { name: "Join Osu Squad" }).click();
  await guest.page.getByRole("link", { name: "Open the crew's season table" }).click();
  await expect(guest.page.getByRole("heading", { name: "Osu Squad" })).toBeVisible();
  const table = guest.page.getByRole("main");
  await expect(table.getByText("Ama", { exact: true }).first()).toBeVisible();
  await expect(table.getByText("Kwame", { exact: true }).first()).toBeVisible();
  await host.context.close();
  await guest.context.close();
});
