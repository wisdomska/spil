import { expect, test } from "@playwright/test";
import { createRoom, phone } from "./harness";

// Custom packs: an adult host writes their own questions and plays them.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("an adult host writes five questions and plays them", async ({ browser }) => {
  const { page, context } = await phone(browser, "host");
  await createRoom(page, { pack: "classic", count: 5, nickname: "Ama" });
  await page.getByRole("button", { name: "Write your own questions" }).click();
  const box = page.getByLabel("Have you ever");
  const mine = [
    "eaten a whole cake alone",
    "sung in the shower",
    "missed a flight",
    "laughed at a funeral",
    "texted the wrong person",
  ];
  for (const q of mine) {
    await box.fill(q);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(`Have you ever ${q}?`)).toBeVisible();
  }
  // The filter refuses contact details.
  await box.fill("followed @someone online");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("No links, emails, numbers or handles in answers.")).toBeVisible();

  await page.getByRole("button", { name: "Play these 5 questions" }).click();
  await expect(page.getByText("Your questions are in. The room is now 18+.")).toBeVisible();
  await page.getByRole("button", { name: "Play solo" }).click();
  const card = page.getByRole("group", { name: /^Question 1 of \d+/ });
  await expect(card).toBeVisible();
  const text = await card.innerText();
  expect(mine.some((q) => text.includes(q))).toBe(true);
  await context.close();
});
