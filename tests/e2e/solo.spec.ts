import { expect, test } from "@playwright/test";
import { answerAll, createRoom, phone, startGame } from "./harness";

// Solo play: one player answers, skips guessing, sees their score without a room guess.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("one player can play a whole round alone", async ({ browser }) => {
  const { page, context } = await phone(browser, "guest");
  await createRoom(page, { pack: "classic", count: 5, nickname: "Senya" });
  await expect(
    page.getByText("Just you. Start solo, or share the invite link first."),
  ).toBeVisible();
  await startGame(page);
  await answerAll(page, "YYNNY");

  // No one else to guess about: straight to Lights down.
  await expect(page.getByText("Your score is in.")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("slider")).toHaveCount(0);
  await page.getByRole("button", { name: "Start the reveal" }).click();
  await expect(page.getByText("REVEAL 1 OF 1")).toBeVisible();
  await expect(page.getByText(/most spilled|Spilled the most/)).toBeVisible({ timeout: 8000 });
  await expect(page.getByText(/^The room guessed/)).toHaveCount(0);
  await expect(page.getByText(/^Off by/)).toHaveCount(0);

  const next = page.getByRole("button", { name: "Next", exact: true });
  await expect(next).not.toHaveAttribute("aria-disabled", "true", { timeout: 10_000 });
  await next.click();
  await expect(page.getByText(/^You scored 60\. Play with friends/)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("Mind Reader")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "How points work" })).toHaveCount(0);
  await context.close();
});
