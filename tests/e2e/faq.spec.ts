import { expect, test } from "@playwright/test";

// FAQ as an accordion (owner request 2026-11-09): the first answer starts open, a tap or the
// keyboard toggles each one, and every answer stays in the page for search engines.
test("FAQ answers open and close from touch and keyboard", async ({ page }) => {
  await page.goto("/faq");
  const first = page.locator("details").first();
  await expect(first).toHaveAttribute("open", "");
  const free = page.locator("details", {
    has: page.getByRole("heading", { name: "Is SPIL free?" }),
  });
  const answer = free.getByText("free to play, with no download");
  await expect(answer).toBeHidden();
  await free.locator("summary").click();
  await expect(answer).toBeVisible();
  await free.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(answer).toBeHidden();
  // Closed answers are still in the HTML, and in the FAQPage data.
  const html = await (await page.request.get("/faq")).text();
  expect(html).toContain("free to play, with no download");
  expect(html).toContain('"@type":"FAQPage"');
});
