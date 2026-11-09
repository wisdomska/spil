import { expect, test } from "@playwright/test";
import { createRoom, phone } from "./harness";

// UX audit 2026-11-09: someone opening the link after the game started is told so straight
// away, before filling in a name, and the copy says the same link gets them into the rematch.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("a late joiner sees the game is in progress before the form", async ({ browser }) => {
  const host = await phone(browser, "host");
  const code = await createRoom(host.page, { pack: "classic", count: 10, nickname: "Host" });
  await host.page.getByRole("button", { name: "Play solo" }).click();
  await expect(host.page.getByRole("group", { name: /^Question 1 of 10/ })).toBeVisible();

  const late = await phone(browser, "guest");
  await late.page.goto(`/r/${code}/me`);
  await expect(
    late.page.getByRole("heading", { name: "This game already started." }),
  ).toBeVisible();
  await expect(late.page.getByText(/Same link, next round/)).toBeVisible();
  await expect(late.page.getByLabel("Nickname")).toHaveCount(0);
  for (const p of [host, late]) await p.context.close();
});
