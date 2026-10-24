import { expect, test } from "@playwright/test";
import {
  answerAll,
  answerSome,
  createRoom,
  guess,
  joinRoom,
  lockIn,
  phone,
  revealAndSkip,
  startGame,
} from "./harness";

// SPIL-01: "Move on without them" must never leave the room stuck. Two contexts, runs once.
test.describe.configure({ mode: "serial" });
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("move on without them never softlocks (SPIL-01)", async ({ browser }) => {
  const host = await phone(browser, "host");
  const guest = await phone(browser, "guest");
  const code = await createRoom(host.page, { pack: "classic", count: 5, nickname: "Senya" });
  await joinRoom(guest.page, code, { nickname: "Kwame" });
  await startGame(host.page);

  // Playtest LMGF: the guest answers 2 of 5, the host finishes and moves on without them.
  await answerSome(guest.page, 2, "YN");
  await answerAll(host.page, "YNYNY");
  await host.page.getByRole("button", { name: "Move on without them" }).click();
  await host.page.getByRole("dialog").getByRole("button", { name: "Move on without them" }).click();

  // The host has nobody to guess about: a locked-in card, never a blank screen.
  await expect(
    host.page.getByRole("heading", { name: "Everyone else sat out this round." }),
  ).toBeVisible();
  await expect(host.page.getByText("Locked in")).toBeVisible();
  await host.page.reload();
  await expect(
    host.page.getByRole("heading", { name: "Everyone else sat out this round." }),
  ).toBeVisible();

  // The guest still guesses about the host; locking that is the last thing the room waits for.
  await expect(guest.page.getByText("Guess 1 of 1")).toBeVisible();
  await guess(guest.page, 60);
  await lockIn(guest.page);

  const started = Date.now();
  await expect(host.page.getByRole("button", { name: "Start the reveal" })).toBeVisible({
    timeout: 10_000,
  });
  await expect(guest.page.getByText("Lights down.")).toBeVisible({
    timeout: 10_000,
  });
  await revealAndSkip(host.page, [guest.page]);
  expect(Date.now() - started).toBeLessThan(40_000);
  await host.context.close();
  await guest.context.close();
});
