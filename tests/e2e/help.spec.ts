import { expect, test } from "@playwright/test";

// SPIL-06: the five help pages from the landing footer and the help tab bar; no sideways scroll.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

const PAGES = [
  ["How to play", "/how-to-play"],
  ["Safety", "/safety"],
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
  ["Contact", "/contact"],
] as const;

test("every help link works from the landing footer (SPIL-06)", async ({ page }) => {
  for (const [label, path] of PAGES) {
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "Footer" })
      .getByRole("link", { name: label, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }
});

test("every help link works from the tab bar, and the bar never scrolls the page (SPIL-06)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const [label, path] of PAGES) {
    await page.goto("/how-to-play");
    const tabs = page.getByRole("navigation", { name: "Pages" });
    await tabs.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(tabs.getByRole("link", { name: label, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const sideways = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(sideways).toBe(0);
  }
});

test("Terms opens with Age and Safety carries the spec copy (SPIL-06)", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { level: 2 }).first()).toHaveText("Age");
  await page.goto("/safety");
  for (const heading of [
    "Skip anything",
    "Report a question",
    "Spill Mode is always optional",
    "Hosts",
    "Age",
  ])
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  await expect(
    page.getByText("Hosts can remove players and move on without slow players."),
  ).toBeVisible();
});
