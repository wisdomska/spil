import { expect, test } from "@playwright/test";
import { adminLogin, createRoom, joinRoom, phone } from "./harness";

// Party Mode: the host pairs a big screen; it shows the room code and who has joined.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("the host pairs a big screen that follows the room", async ({ browser, baseURL }) => {
  const admin = await adminLogin(browser, baseURL!);
  const flag = (enabled: boolean) =>
    admin.page.request.patch(`${baseURL}/api/v1/admin/flags`, {
      data: { key: "party_mode", enabled },
    });
  try {
    expect((await flag(true)).status()).toBe(200);
    const host = await phone(browser, "host");
    const code = await createRoom(host.page, { pack: "classic", count: 5, nickname: "Senya" });
    await host.page.getByRole("button", { name: "Party Mode: show it on a TV" }).click();
    await expect(
      host.page.getByRole("dialog", { name: "Show the game on a big screen" }),
    ).toBeVisible();
    const link = (await host.page.getByRole("dialog").locator("p.font-mono").innerText()).trim();
    expect(link).toContain(`/r/${code}/tv?t=`);

    const tv = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const screen = await tv.newPage();
    await screen.goto(link);
    await expect(screen.getByRole("heading", { name: "Grab your phones." })).toBeVisible();
    await expect(screen.getByText(code, { exact: true })).toBeVisible();
    await expect(screen.getByText("Senya", { exact: true })).toBeVisible();

    const guest = await phone(browser, "guest");
    await joinRoom(guest.page, code, { nickname: "Ama" });
    await expect(screen.getByText("Ama", { exact: true })).toBeVisible({ timeout: 10_000 });

    // A screen without the token is turned away.
    await screen.goto(`/r/${code}/tv`);
    await expect(screen.getByRole("heading", { name: "This screen is not paired." })).toBeVisible();
    for (const c of [host.context, guest.context, tv]) await c.close();
  } finally {
    await flag(false);
    await admin.cleanup();
  }
});
