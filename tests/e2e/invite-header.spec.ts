import { expect, test } from "@playwright/test";
import { createRoom, phone } from "./harness";

// SPIL-19: an invite link says whose room and which pack in its first paint.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("invite page shows the room before the form", async ({ browser, request }) => {
  const host = await phone(browser, "host");
  const code = await createRoom(host.page, { pack: "classic", count: 5, nickname: "Ama" });

  // Server-rendered: the HTML itself carries the card, before any script runs.
  const html = await (await request.get(`/r/${code}/me`)).text();
  expect(html).toContain("Joining Ama&#x27;s room");

  const guest = await phone(browser, "guest");
  await guest.page.goto(`/r/${code}/me`);
  await expect(guest.page.getByText("Joining Ama's room")).toBeVisible();
  await expect(guest.page.getByText("Classic · 1 in")).toBeVisible();
  await expect(guest.page.getByRole("heading", { name: "How old are you?" })).toBeVisible();

  // A room that does not exist keeps its own screen.
  await guest.page.goto("/r/ZZZZ/me");
  await expect(guest.page.getByText(/Joining/)).toHaveCount(0);
  for (const p of [host, guest]) await p.context.close();
});
