import { expect, test } from "@playwright/test";
import { createRoom, phone } from "./harness";

// SPIL-27: taps during the card's exit are kept and land in order.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("rapid taps record every answer in order", async ({ browser }) => {
  const { page, context } = await phone(browser, "guest");
  await createRoom(page, { pack: "classic", count: 10, nickname: "Senya" });
  await page.getByRole("button", { name: "Play solo" }).click();
  await expect(page.getByRole("group", { name: /^Question 1 of 10/ })).toBeVisible();

  // Nine taps, faster than the 200 ms exit: Yes, No, Yes, ...
  const pattern = ["Yes", "No", "Yes", "No", "Yes", "No", "Yes", "No", "Yes"];
  for (const name of pattern) {
    await page.getByRole("button", { name, exact: true }).click({ delay: 0 });
    await page.waitForTimeout(120);
  }
  await expect(page.getByRole("group", { name: /^Question 10 of 10/ })).toBeVisible();

  // Walk back: every card shows the answer that was tapped for it.
  for (let n = 9; n >= 1; n--) {
    await page.getByRole("button", { name: "Previous question" }).click();
    const card = page.getByRole("group", { name: new RegExp(`^Question ${n} of 10`) });
    await expect(card).toContainText(`You said ${pattern[n - 1]}`);
  }
  await context.close();
});

// UX audit 2026-11-09: a double tap on the second to last card answers that card only. The
// last card locks the round in, so it always needs its own tap.
test("a double tap never answers the last card", async ({ browser }) => {
  const { page, context } = await phone(browser, "guest");
  await createRoom(page, { pack: "classic", count: 10, nickname: "Senya" });
  await page.getByRole("button", { name: "Play solo" }).click();
  for (let n = 1; n <= 8; n++) {
    await expect(
      page.getByRole("group", { name: new RegExp(`^Question ${n} of 10`) }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Yes", exact: true }).click();
  }
  await expect(page.getByRole("group", { name: /^Question 9 of 10/ })).toBeVisible();
  const yes = page.getByRole("button", { name: "Yes", exact: true });
  await yes.click({ delay: 0 });
  await yes.click({ delay: 0 }).catch(() => {});
  // The second tap is dropped: the last card waits, unanswered, and nothing was locked in.
  const last = page.getByRole("group", { name: /^Question 10 of 10/ });
  await expect(last).toBeVisible();
  await page.waitForTimeout(800);
  await expect(last).toBeVisible();
  await expect(last).not.toContainText("You said");
  await context.close();
});
