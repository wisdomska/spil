import { expect, test } from "@playwright/test";
import { answerAll, createRoom, phone, revealAndSkip } from "./harness";

// SPIL-13: a round with no awards shows no award badge anywhere, card included.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

const AWARD_NAMES = /Open Book|Top Spiller|Saint of the Room|Dark Horse|Clueless/;

test("no awards means no badge on the share card", async ({ browser }) => {
  const { page, context } = await phone(browser, "guest");
  await createRoom(page, { pack: "classic", count: 5, nickname: "Senya" });
  await page.getByRole("button", { name: "Play solo" }).click();
  await answerAll(page, "YYNNY");
  await revealAndSkip(page);

  await page.getByRole("tab", { name: "Awards" }).click();
  await expect(page.getByText("Awards start at 3 players.", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Share my card" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "Your card" })).toBeVisible();
  // The card itself rendered (its Spill Score label), so the check below is not vacuous.
  await expect(sheet.getByText("Spill Score").first()).toBeAttached();
  await expect(sheet.getByText(AWARD_NAMES)).toHaveCount(0);
  await sheet.getByText("Group 1:1").click();
  await expect(sheet.getByText(AWARD_NAMES)).toHaveCount(0);
  await context.close();
});
