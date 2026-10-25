import { expect, test } from "@playwright/test";
import { createRoom, joinRoom, phone } from "./harness";

// SPIL-14: one tap on "Start the game" starts it, even right after the lobby changed.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("one tap starts the game after a pack change and a rejoin", async ({ browser }) => {
  const host = await phone(browser, "host");
  const guest = await phone(browser, "guest");
  const code = await createRoom(host.page, { pack: "classic", count: 5, nickname: "Ama" });
  await joinRoom(guest.page, code, { nickname: "Esi" });
  await expect(host.page.getByText("2 in. Everyone ready?")).toBeVisible();

  await host.page.getByRole("link", { name: /Change pack/ }).click();
  await host.page.getByRole("radio", { name: /Campus Life/ }).click();
  await host.page.getByRole("button", { name: /Continue with Campus Life/ }).click();
  await host.page.waitForURL(new RegExp(`/r/${code}$`));

  // The guest leaves and joins again; the host's lobby updates twice.
  await guest.page.getByRole("button", { name: "Leave room" }).first().click();
  await guest.page.getByRole("dialog").getByRole("button", { name: "Leave room" }).click();
  await expect(host.page.getByText("Ready to play solo.")).toBeVisible();
  await joinRoom(guest.page, code, { nickname: "Esi" });
  await expect(host.page.getByText("2 in. Everyone ready?")).toBeVisible();

  await host.page.getByRole("button", { name: "Start the game" }).click();
  await expect(host.page.getByRole("group", { name: /^Question 1 of/ })).toBeVisible({
    timeout: 10_000,
  });
  for (const p of [host, guest]) await p.context.close();
});
