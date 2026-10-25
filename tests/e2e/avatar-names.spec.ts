import { expect, test } from "@playwright/test";
import { passAgeGate, phone } from "./harness";

// SPIL-26: faces have names, and Hot face is only offered in 18+ rooms.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

async function profileFor(pack: RegExp, page: import("@playwright/test").Page) {
  await page.goto("/create");
  await passAgeGate(page);
  await page
    .getByRole("radiogroup", { name: "Question pack" })
    .getByRole("radio", { name: pack })
    .first()
    .click();
  await page.getByRole("button", { name: /^Continue with/ }).click();
  await page.waitForURL(/\/r\/[A-Z0-9]{4}\/me$/, { timeout: 30_000 });
}

test("faces are named; Hot face only in 18+ rooms", async ({ browser }) => {
  const { page, context } = await phone(browser, "guest");
  await profileFor(/Classic/i, page);
  await expect(page.getByRole("radio", { name: "Avatar: Ghost" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Avatar: Hot face" })).toHaveCount(0);
  const checked = page.getByRole("radio", { checked: true });
  await expect(checked).not.toHaveAccessibleName(/Clown|Skull|Hot face/);

  await profileFor(/After Dark/i, page);
  await expect(page.getByRole("radio", { name: "Avatar: Hot face" })).toBeVisible();
  await context.close();
});
