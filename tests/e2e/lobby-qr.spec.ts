import { expect, test } from "@playwright/test";
import { createRoom, phone } from "./harness";

// SPIL-28: the lobby offers a QR code of the invite link (desktop inline, phone in a sheet).
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("lobby QR code leads to the invite page", async ({ browser }) => {
  const { page, context } = await phone(browser, "guest");
  const code = await createRoom(page, { pack: "classic", count: 5, nickname: "Ama" });
  const name = `QR code to join room ${code}`;

  // Phone: a "Show QR" button opens a sheet with the QR and the code.
  await page.getByRole("button", { name: "Show QR" }).click();
  const sheet = page.getByRole("dialog");
  const qr = sheet.getByRole("img", { name });
  await expect(qr).toBeVisible();
  const link = await qr.getAttribute("data-value");
  expect(link).toMatch(new RegExp(`/r/${code}$`));
  await expect(sheet.getByText(code, { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  // Desktop: the main column shows the QR instead of a second copy of the code.
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole("img", { name })).toBeVisible();
  await expect(page.getByText("Scan to join")).toBeVisible();
  await expect(page.getByRole("button", { name: "Show QR" })).toBeHidden();

  // The encoded link opens this room's invite page.
  await page.goto(new URL(link!).pathname);
  await expect(page).toHaveURL(new RegExp(`/r/${code}`));
  await context.close();
});
