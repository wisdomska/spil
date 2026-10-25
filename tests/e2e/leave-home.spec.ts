import { expect, test } from "@playwright/test";
import { createRoom, joinRoom, phone } from "./harness";

// SPIL-25: leaving mid-game always lands on the home page, focus on "Start a game".
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("leaving in game goes home", async ({ browser }) => {
  const host = await phone(browser, "host");
  const guest = await phone(browser, "guest");
  const code = await createRoom(host.page, { pack: "classic", count: 5, nickname: "Ama" });
  await joinRoom(guest.page, code, { nickname: "Esi" });
  await host.page.getByRole("button", { name: "Start the game" }).click();
  await expect(guest.page.getByRole("group", { name: /^Question 1 of/ })).toBeVisible();

  await guest.page.getByRole("button", { name: "Leave room" }).first().click();
  await guest.page.getByRole("dialog").getByRole("button", { name: "Leave room" }).click();
  await guest.page.waitForURL((u) => u.pathname === "/");
  await expect(guest.page.getByText("You left the room.")).toBeVisible();
  await expect(guest.page.locator("#start-room")).toBeFocused();
  // It stays home: nothing sends it back to the nickname form.
  await guest.page.waitForTimeout(2500);
  expect(new URL(guest.page.url()).pathname).toBe("/");
  for (const p of [host, guest]) await p.context.close();
});
