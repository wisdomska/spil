import { expect, test } from "@playwright/test";
import { adminLogin, createRoom, phone } from "./harness";

// Admin Users (owner request 2026-11-09): guests who played are listed with their name and a
// Guest tag, next to accounts, and the Guests filter shows them alone.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("a guest who played shows in Users with their name and a Guest tag", async ({
  browser,
  baseURL,
}) => {
  const nickname = `G${Date.now().toString(36).slice(-6)}`;
  const guest = await phone(browser, "guest");
  await createRoom(guest.page, { pack: "classic", count: 10, nickname });

  const admin = await adminLogin(browser, baseURL!);
  await admin.page.goto("/admin/users?filter=guests");
  await admin.page.getByPlaceholder("Search names").fill(nickname);
  const row = admin.page.getByRole("row", { name: new RegExp(nickname) });
  await expect(row).toBeVisible();
  await expect(row.getByText("Guest", { exact: true })).toBeVisible();
  await admin.page.goto("/admin/users");
  await expect(admin.page.getByRole("row", { name: new RegExp(nickname) })).toBeVisible();
  await admin.page.screenshot({ path: "test-results/admin-users-all.png" });
  await guest.context.close();
  await admin.cleanup();
});
