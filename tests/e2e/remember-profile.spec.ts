import { expect, test } from "@playwright/test";
import { createRoom, passAgeGate, phone } from "./harness";

// SPIL-17: the second room on this phone needs no typing; "Not you?" clears it.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("nickname and face are remembered on this device", async ({ browser }) => {
  const { page, context } = await phone(browser, "guest");
  await createRoom(page, { pack: "classic", count: 5, nickname: "Senya" });

  await page.goto("/create");
  await passAgeGate(page);
  await page.getByRole("button", { name: /^Spill Score/ }).click();
  await page.getByRole("button", { name: /^Continue with/ }).click();
  await page.waitForURL(/\/r\/[A-Z0-9]{4}\/me$/, { timeout: 30_000 });
  const nickname = page.getByLabel("Nickname");
  await expect(nickname).toHaveValue("Senya");
  const faces = page.getByRole("radiogroup").first().getByRole("radio");
  await expect(faces.nth(4)).toHaveAttribute("aria-checked", "true");

  // Not you? empties the form; reload shows nothing is kept.
  await page.getByRole("button", { name: /Clear the saved name/ }).click();
  await expect(nickname).toHaveValue("");
  await page.reload();
  await expect(page.getByLabel("Nickname")).toHaveValue("");
  await expect(page.getByRole("button", { name: /Clear the saved name/ })).toHaveCount(0);

  // Join again with a name: zero typing next time.
  await page.getByLabel("Nickname").fill("Senya");
  await page.getByRole("button", { name: "Open the lobby" }).click();
  await expect(page.getByRole("heading", { name: "In the room" })).toBeVisible();
  await page.goto("/create");
  await passAgeGate(page);
  await page.getByRole("button", { name: /^Spill Score/ }).click();
  await page.getByRole("button", { name: /^Continue with/ }).click();
  await page.waitForURL(/\/r\/[A-Z0-9]{4}\/me$/, { timeout: 30_000 });
  await page.getByRole("button", { name: "Open the lobby" }).click();
  await expect(page.getByRole("heading", { name: "In the room" })).toBeVisible();
  await context.close();
});
