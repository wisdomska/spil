import { expect, test } from "@playwright/test";
import { createRoom, phone } from "./harness";

// Owner request: a server hiccup is not the player's business. The room keeps its loading
// skeleton (or the game already on screen), retries quietly, and only after a few seconds says it
// is taking longer than usual. No talk of servers.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("a failing room load retries quietly and recovers by itself", async ({ browser }) => {
  const { page, context } = await phone(browser, "host");
  const code = await createRoom(page, { pack: "classic", count: 5, nickname: "Ama" });

  let failing = true;
  await page.route(`**/api/v1/rooms/${code}/state`, (route) =>
    failing
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: '{"error":{"code":"INTERNAL","message":"x"}}',
        })
      : route.continue(),
  );
  await page.reload();
  await expect(page.getByText(/server/i)).toHaveCount(0);
  await expect(page.getByText("This is taking longer than usual.")).toBeVisible({
    timeout: 12_000,
  });
  await expect(page.getByText(/server/i)).toHaveCount(0);

  // It keeps retrying: once loading works again, the room comes back without a tap.
  failing = false;
  await expect(page.getByRole("heading", { name: "In the room" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("This is taking longer than usual.")).toHaveCount(0);
  await context.close();
});
