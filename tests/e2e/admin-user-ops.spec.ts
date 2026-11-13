import { expect, test } from "@playwright/test";
import { adminLogin, createRoom, passAgeGate, phone, pickGame, pickPack } from "./harness";

// Admin console overhaul (owner request 2026-11-12): acting on players, switching games off, the
// player notice, and branded controls with no browser default dropdowns.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("an admin bans a guest, the guest is benched, and the ban lifts", async ({
  browser,
  baseURL,
}) => {
  const nickname = `B${Date.now().toString(36).slice(-6)}`;
  const guest = await phone(browser, "guest");
  await createRoom(guest.page, { pack: "classic", count: 10, nickname });

  const admin = await adminLogin(browser, baseURL!);
  const page = admin.page;
  await page.goto("/admin/users?filter=guests");
  await page.getByPlaceholder("Search names").fill(nickname);
  await page
    .getByRole("button", { name: `Open ${nickname}` })
    .first()
    .click();

  const sheet = page.getByRole("dialog", { name: nickname });
  await expect(sheet.getByText("In 1 live room")).toBeVisible();
  await expect(sheet.getByText("Recent rooms")).toBeVisible();
  await sheet.getByRole("button", { name: "Ban" }).click();

  const ban = page.getByRole("dialog", { name: `Ban ${nickname}?` });
  // The branded dropdown: a listbox of our own, not the browser's.
  await ban.getByRole("combobox", { name: "How long" }).click();
  await page.getByRole("option", { name: "1 day" }).click();
  await ban.getByLabel("Reason").fill("Spam in names");
  await ban.getByRole("button", { name: "Ban" }).click();
  await expect(page.getByText(`${nickname} is banned.`)).toBeVisible();
  await expect(sheet.getByText("Reason: Spam in names")).toBeVisible();

  // The guest was taken out of the room, and their next request lands on the banned page.
  await guest.page.goto("/create");
  await passAgeGate(guest.page);
  // Spill Score has several packs: choosing one creates the room, which the API refuses.
  if (!(await pickGame(guest.page))) await pickPack(guest.page, { pack: "classic", count: 10 });
  await expect(guest.page).toHaveURL(/\/banned$/, { timeout: 15_000 });
  await expect(
    guest.page.getByRole("heading", { name: /can't play SPIL right now/ }),
  ).toBeVisible();

  // The audit log has it, and lifting the ban works from the Banned filter.
  await page.goto("/admin/users?filter=banned");
  await page.getByPlaceholder("Search names").fill(nickname);
  await page
    .getByRole("button", { name: `Open ${nickname}` })
    .first()
    .click();
  await page
    .getByRole("dialog", { name: nickname })
    .getByRole("button", { name: "Lift ban" })
    .click();
  await expect(page.getByText(`${nickname} can play again.`)).toBeVisible();
  await page.goto("/admin/audit");
  await expect(page.getByText("Banned a player").first()).toBeVisible();

  await guest.context.close();
  await admin.cleanup();
});

test("the users table sorts, selects and has no native controls", async ({ browser, baseURL }) => {
  const admin = await adminLogin(browser, baseURL!);
  const page = admin.page;
  await page.goto("/admin/users");
  await expect(page.getByRole("columnheader", { name: "Games" })).toBeVisible();
  await page.getByRole("button", { name: "Games" }).click();
  await expect(page).toHaveURL(/sort=games_desc/);
  await expect(page.getByRole("columnheader", { name: "Games" })).toHaveAttribute(
    "aria-sort",
    "descending",
  );
  const selectAll = page.getByRole("checkbox", { name: "Select everyone on this page" });
  await selectAll.click();
  await expect(page.getByText(/selected$/)).toBeVisible();
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(selectAll).toHaveAttribute("aria-checked", "false");
  await expect(page.locator("select")).toHaveCount(0);
  await expect(page.locator('input[type="checkbox"]:visible')).toHaveCount(0);
  await page.screenshot({ path: "test-results/admin-users-sorted.png" });
  await admin.cleanup();
});

test("switching a game off hides it from Start a game, and the notice reaches players", async ({
  browser,
  baseURL,
}) => {
  const admin = await adminLogin(browser, baseURL!);
  const page = admin.page;
  await page.goto("/admin/settings");
  const hotTakes = page.getByRole("switch", { name: /^Hot Takes/ });
  await expect(hotTakes).toHaveAttribute("aria-checked", "true");
  await hotTakes.click();
  await expect(page.getByText("Hot Takes is off for new rooms.")).toBeVisible();

  const notice = `Back in a minute ${Date.now().toString(36)}`;
  await page.getByLabel("Notice", { exact: true }).fill(notice);
  await page.getByRole("button", { name: "Show to players" }).click();
  await expect(page.getByText("Players can see the notice.")).toBeVisible();

  const player = await phone(browser, "guest");
  try {
    await player.page.goto("/create");
    await passAgeGate(player.page);
    await expect(player.page.getByRole("status").filter({ hasText: notice })).toBeVisible();
    await expect(player.page.getByRole("button", { name: /^Spill Score/ })).toBeVisible();
    // Pages read settings through a 15 second cache, so the change can take that long to show.
    await expect(async () => {
      await player.page.reload();
      await expect(player.page.getByRole("button", { name: /^Spill Score/ })).toBeVisible();
      await expect(player.page.getByRole("button", { name: /^Hot Takes/ })).toHaveCount(0);
    }).toPass({ timeout: 40_000, intervals: [2_000, 5_000] });
  } finally {
    await page.goto("/admin/settings");
    await page.getByRole("switch", { name: /^Hot Takes/ }).click();
    await expect(page.getByText("Hot Takes is on.")).toBeVisible();
    await page.getByRole("button", { name: "Turn off" }).click();
    await expect(page.getByText("The notice is off.")).toBeVisible();
    await player.context.close();
    await admin.cleanup();
  }
});

test("admin dropdowns open our own list", async ({ browser, baseURL }) => {
  const admin = await adminLogin(browser, baseURL!);
  const page = admin.page;
  await page.goto("/admin/questions");
  const status = page.getByRole("combobox", { name: "Status" });
  await status.click();
  const list = page.getByRole("listbox");
  await expect(list).toBeVisible();
  await page.screenshot({ path: "test-results/admin-select-open.png" });
  await list.getByRole("option", { name: "Hidden" }).click();
  await expect(status).toHaveText(/Hidden/);
  await expect(page.locator("select")).toHaveCount(0);
  await admin.cleanup();
});
