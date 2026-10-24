import { expect, test, type Page } from "@playwright/test";
import { answerSome, createRoom, joinRoom, phone, startGame } from "./harness";

// SPIL-03: live answer counts in the host's side panel and the force dialog. Runs once.
test.describe.configure({ mode: "serial" });
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

const row = (page: Page, name: RegExp) =>
  page.locator("aside div.flex.items-center").filter({ hasText: name });

test("answer counts are live, own count is instant (SPIL-03)", async ({ browser }) => {
  const host = await phone(browser, "host");
  const guest = await phone(browser, "guest");
  const code = await createRoom(host.page, { pack: "classic", count: 5, nickname: "Senya" });
  await joinRoom(guest.page, code, { nickname: "Kwame" });
  await startGame(host.page);
  await expect(guest.page.getByRole("progressbar", { name: "Questions answered" })).toBeVisible();

  // Own row moves the moment the host answers, before any server echo.
  await answerSome(host.page, 1, "Y");
  await expect(row(host.page, /Senya/)).toContainText("1/5", { timeout: 1000 });

  // The guest's count reaches the host within a second of each answer (realtime).
  for (let n = 1; n <= 3; n++) {
    await guest.page.keyboard.press(n % 2 ? "y" : "n");
    await expect(row(host.page, /Kwame/)).toContainText(`${n}/5`, { timeout: 2000 });
  }

  // Host finishes; the force dialog shows the live count and holds right after an answer.
  for (let q = 2; q <= 5; q++) {
    await expect(
      host.page.getByRole("group", { name: new RegExp(`^Question ${q} of 5`) }),
    ).toBeVisible();
    await host.page.keyboard.press("n");
  }
  await guest.page.keyboard.press("y");
  await host.page.getByRole("button", { name: "Move on without them" }).click();
  const dialog = host.page.getByRole("dialog");
  await expect(dialog).toContainText(/4\/5 · last answer \d+s ago/);
  await expect(dialog.getByRole("button", { name: "They're still going…" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Move on without them" })).toBeEnabled({
    timeout: 5000,
  });
  await host.context.close();
  await guest.context.close();
});
