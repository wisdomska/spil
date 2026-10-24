import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { FRAMES } from "../visual/frames";
import { apiPlayer, hostRoom, newPlayer } from "./helpers";

// WCAG 2.2 AA (NFR-AC-01; SPIL is dark only): zero serious or critical axe findings on every route.
async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    bad,
    `${label}: ${bad.map((v) => `${v.id} (${v.nodes.length}) ${v.help}`).join("; ")}`,
  ).toEqual([]);
}

const STATIC_ROUTES = [
  "/",
  "/join",
  "/create",
  "/how-to-play",
  "/privacy",
  "/terms",
  "/contact",
  "/not-a-page",
];

for (const theme of ["dark"] as const) {
  test(`static routes have no serious a11y issues (${theme})`, async ({ browser }) => {
    const p = await newPlayer(browser, "A11y");
    for (const route of STATIC_ROUTES) {
      await p.page.goto(route);
      // Not "networkidle": the Turnstile test widget on /create keeps one request open forever.
      await p.page.waitForLoadState("load");
      await p.page.evaluate(() => document.fonts.ready);
      await audit(p.page, `${route} ${theme}`);
    }
    await p.context.close();
  });

  test(`room screens have no serious a11y issues (${theme})`, async ({ browser, baseURL }) => {
    const host = await newPlayer(browser, "Ama");
    const code = await hostRoom(host, { pack: "Classic", count: 5 });
    await audit(host.page, `lobby ${theme}`);
    for (const n of ["Kofi", "Efua"]) await apiPlayer(baseURL!, n).then((p) => p.join(code));
    await host.page.getByRole("button", { name: "Start the game" }).click();
    await expect(host.page.getByRole("group", { name: /^Question 1/ })).toBeVisible();
    await audit(host.page, `question ${theme}`);
    await host.context.close();
  });
}

test("keyboard only: landing to pack picker with visible focus", async ({ page }) => {
  await page.goto("/");
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return null;
      const style = getComputedStyle(el);
      return { text: el.textContent?.trim().slice(0, 40), outline: style.outlineStyle };
    });
    if (focused?.text === "Start a room") {
      expect(focused.outline).not.toBe("none");
      await page.keyboard.press("Enter");
      await expect(page.getByRole("heading", { name: "Pick your poison." })).toBeVisible();
      return;
    }
  }
  throw new Error("Start a room was not reachable by keyboard");
});

// Phones as narrow as 375 px: no screen may scroll sideways (every design frame's app state).
test("no screen scrolls sideways at 375 px", async ({ browser }) => {
  test.setTimeout(600_000);
  const wide: string[] = [];
  for (const frame of FRAMES.filter((f) => f.set === "mobile")) {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    await frame.go(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 0) wide.push(`${frame.slug} (+${overflow}px)`);
    await context.close();
  }
  expect(wide, wide.join(", ")).toEqual([]);
});
