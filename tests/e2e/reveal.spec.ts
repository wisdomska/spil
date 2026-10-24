import { expect, test } from "@playwright/test";
import { answerAll, createRoom, guessAll, joinRoom, phone, startGame } from "./harness";

// SPIL-11: the host paces the reveal; guests follow the same slide. Two phones, runs once.
test.describe.configure({ mode: "serial" });
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("host taps Next through the reveal; the guest follows each step (SPIL-11)", async ({
  browser,
}) => {
  const host = await phone(browser, "host");
  const guest = await phone(browser, "guest");
  const code = await createRoom(host.page, { pack: "classic", count: 5, nickname: "Ama" });
  await joinRoom(guest.page, code, { nickname: "Kwame" });
  await startGame(host.page);
  await answerAll(host.page, "YYYYN");
  await answerAll(guest.page, "NNYNN");
  await guessAll(host.page, 30);
  await guessAll(guest.page, 70);
  await host.page.getByRole("button", { name: "Start the reveal" }).click();
  const started = Date.now();

  // Slide 1: NEXT UP first, the room's guess before the fill, the rank only after the stamp.
  for (const p of [host.page, guest.page]) {
    await expect(p.getByText("REVEAL 1 OF 2")).toBeVisible();
    await expect(p.getByText("NEXT UP")).toBeVisible();
  }
  await expect(guest.page.getByText("Waiting for Ama…")).toBeVisible();
  await expect(guest.page.getByRole("button", { name: "Next", exact: true })).toHaveCount(0);
  await expect(host.page.getByText(/^The room guessed \d+$/)).toBeVisible();
  await expect(host.page.getByText(/most spilled|Spilled the most/)).toBeVisible({ timeout: 6000 });
  await expect(guest.page.getByText(/most spilled|Spilled the most/)).toBeVisible();
  await expect(host.page.getByText(/^Off by \d+\./)).toBeVisible();

  // Next unlocks after the verdict; a double tap moves one slide only.
  const next = host.page.getByRole("button", { name: "Next", exact: true });
  await expect(next).not.toHaveAttribute("aria-disabled", "true", { timeout: 10_000 });
  await next.dblclick();
  // The drumroll beat lasts 1.5 s, so check it on the host straight away.
  await expect(host.page.getByText("And the biggest spill of the night…")).toBeVisible();
  for (const p of [host.page, guest.page]) await expect(p.getByText("REVEAL 2 OF 2")).toBeVisible();

  // The last slide, then results on both phones; it took at least 10 seconds.
  await expect(next).not.toHaveAttribute("aria-disabled", "true", { timeout: 12_000 });
  await next.click();
  for (const p of [host.page, guest.page])
    await expect(p.getByRole("tab", { name: "Scores" })).toBeVisible({ timeout: 15_000 });
  expect(Date.now() - started).toBeGreaterThanOrEqual(10_000);
  await host.context.close();
  await guest.context.close();
});

test("the sound toggle is remembered on the device (SPIL-11)", async ({ page }) => {
  await page.goto("/dev/screens/reveal?variant=count");
  const speaker = page.getByRole("button", { name: "Sound on" });
  await speaker.click();
  await expect(page.getByRole("button", { name: "Sound off" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.reload();
  await expect(page.getByRole("button", { name: "Sound off" })).toBeVisible();
});
