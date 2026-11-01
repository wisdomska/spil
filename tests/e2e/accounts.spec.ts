import { expect, test, type Page } from "@playwright/test";
import { passAgeGate, phone } from "./harness";

// Optional accounts (owner decision 2026-10-26): username and password, a one-time recovery
// code, sign-in on a second phone with its guest progress, and delete.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

const PASSWORD = "tiger lily jam 42";

async function saveProgress(page: Page, username: string) {
  await page.goto("/profile");
  await page.getByRole("button", { name: "Save your progress" }).click();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill("Password123");
  await page.getByRole("button", { name: "Save my progress" }).click();
  await expect(page.getByText("That password is too easy to guess.")).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Save my progress" }).click();
  const code = (await page.getByTestId("recovery-code").textContent())!.trim();
  expect(code).toMatch(/^[2-9A-Z]{4}(-[2-9A-Z]{4}){3}$/);
  // Done waits until the code is saved.
  await expect(page.getByRole("button", { name: "Done" })).toHaveAttribute("aria-disabled", "true");
  await page.getByLabel("I saved my recovery code").check();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("heading", { name: `Signed in as ${username}` })).toBeVisible();
  return code;
}

test("save progress, sign out, sign in on a second phone with its progress, recover, delete", async ({
  browser,
}) => {
  const username = `e2e_${Date.now().toString(36)}`;
  const first = await phone(browser, "host");
  const code = await saveProgress(first.page, username);

  // The menu offers Sign out once signed in.
  await first.page.getByRole("button", { name: /^Menu for / }).click();
  await expect(first.page.getByRole("menu").getByText(`Signed in as ${username}`)).toBeVisible();
  await first.page.getByRole("menuitem", { name: "Sign out" }).click();
  await first.page.goto("/profile");
  await expect(first.page.getByRole("button", { name: "Save your progress" })).toBeVisible();

  // A second phone answered Today's Spill as a guest; signing in can add that.
  const second = await phone(browser, "guest");
  await second.page.goto("/daily");
  await passAgeGate(second.page);
  // Wait for the answer to save before leaving the page.
  await Promise.all([
    second.page.waitForResponse(
      (r) => r.url().endsWith("/api/v1/daily") && r.request().method() === "POST",
    ),
    second.page.getByRole("button", { name: "Yes", exact: true }).click(),
  ]);
  await second.page.goto("/sign-in");
  await second.page.getByLabel("Username").fill(username.toUpperCase());
  await second.page.getByLabel("Password", { exact: true }).fill("wrong password 1");
  await second.page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(second.page.getByText("That username and password do not match.")).toBeVisible();
  await second.page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  const merge = second.page.getByLabel(/Add this phone's badges/);
  await expect(merge).toBeChecked();
  await second.page.getByRole("button", { name: "Sign in", exact: true }).click();
  await second.page.waitForURL(/\/profile$/);
  await expect(
    second.page.getByRole("heading", { name: `Signed in as ${username}` }),
  ).toBeVisible();

  // Forgot the password: the recovery code sets a new one and gives a new code.
  await first.page.goto("/recover");
  await first.page.getByLabel("Username").fill(username);
  await first.page.getByLabel("Recovery code").fill(code.toLowerCase());
  await first.page.getByLabel("New password").fill("brand new words 7");
  await first.page.getByRole("button", { name: "Set new password" }).click();
  const next = (await first.page.getByTestId("recovery-code").textContent())!.trim();
  expect(next).not.toBe(code);
  await first.page.getByLabel("I saved my recovery code").check();
  await first.page.getByRole("button", { name: "Done" }).click();
  await first.page.waitForURL(/\/profile$/);

  // Delete account: type the username to confirm.
  await first.page.getByRole("button", { name: "Delete account" }).click();
  const sheet = first.page.getByRole("dialog");
  await sheet.getByLabel(`Type ${username} to confirm`).fill("nope");
  await sheet.getByRole("button", { name: "Delete my account" }).click();
  await expect(sheet.getByText("Type your username exactly to confirm.")).toBeVisible();
  await sheet.getByLabel(`Type ${username} to confirm`).fill(username);
  await sheet.getByRole("button", { name: "Delete my account" }).click();
  await expect(first.page.getByRole("button", { name: "Save your progress" })).toBeVisible();

  for (const p of [first, second]) await p.context.close();
});

test("the save prompt appears with a first badge and hides on Not now", async ({ browser }) => {
  const { page, context } = await phone(browser, "guest");
  await page.route("**/api/v1/me/badges", async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    body.achievements[0].unlocked = true;
    await route.fulfill({ response: res, json: body });
  });
  await page.goto("/badges");
  const prompt = page.getByText("You earned a badge. Save your progress");
  await expect(prompt).toBeVisible();
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(prompt).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your badges" })).toBeVisible();
  await expect(prompt).toHaveCount(0);
  await context.close();
});
