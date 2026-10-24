import { expect, test } from "@playwright/test";
import { passAgeGate, phone } from "./harness";

// SPIL-05: a refused bot check is never silent. Needs Turnstile test keys (local and preview).
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
  info.skip(!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY, "needs the Turnstile test keys");
});

test("a refused bot check shows the error, a toast and a visible check; then it works (SPIL-05)", async ({
  browser,
}) => {
  const { page, context } = await phone(browser, "guest");
  await page.goto("/create");
  await passAgeGate(page, 25);

  // The server refuses the first attempt, as Cloudflare would for a failed check.
  let refused = false;
  await page.route("**/api/v1/rooms", async (route) => {
    if (refused || route.request().method() !== "POST") return route.continue();
    refused = true;
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "CAPTCHA_FAILED", message: "" } }),
    });
  });

  const message =
    "We couldn't confirm you're a person. Try again, or turn off your VPN if you use one.";
  const cta = page.getByRole("button", { name: /^Continue with/ });
  await cta.click();
  await expect(page.getByRole("alert").filter({ hasText: message })).toBeVisible();
  await expect(page.getByText(message)).toHaveCount(2); // inline error and toast
  await expect(page.getByText("Quick check")).toBeVisible();
  await expect(cta).not.toHaveAttribute("aria-busy", "true");

  // The visible check passes (test keys), and the second try creates the room.
  await cta.click();
  await page.waitForURL(/\/r\/[A-Z0-9]{4}\/me$/, { timeout: 30_000 });
  await context.close();
});
