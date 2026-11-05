import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type Page } from "@playwright/test";
import { adminLogin } from "../e2e/harness";
import { FRAMES } from "./frames";

/**
 * Baseline screenshots for the fix handoff QA matrix: every screen at every width, so later
 * changes can be compared (tests/visual/compare-baseline.mjs). Writes full-page PNGs to
 * tests/visual/baseline/<viewport>/<screen>.png (or BASELINE_DIR) and an index of screens that
 * scroll sideways. Run: E2E_BASE_URL=http://localhost:3100 pnpm test:baseline
 */
const OUT = process.env.BASELINE_DIR ?? "tests/visual/baseline";

const ALL_VIEWPORTS: Array<{ label: string; width: number; height: number; scale?: number }> = [
  ...[320, 360, 375, 390, 414].map((w) => ({ label: `w${w}`, width: w, height: 812 })),
  { label: "w768", width: 768, height: 1024 },
  { label: "w1024", width: 1024, height: 768 },
  { label: "w1280", width: 1280, height: 800 },
  { label: "w1440", width: 1440, height: 900 },
  { label: "w1920", width: 1920, height: 1080 },
  { label: "landscape", width: 844, height: 390 },
  // 200% browser zoom on a 1280 x 800 window: half the CSS pixels at twice the density.
  { label: "zoom200", width: 640, height: 400, scale: 2 },
];

// BASELINE_VIEWPORTS=w375,w1280 runs a subset (for a quick audit).
const ONLY = process.env.BASELINE_VIEWPORTS?.split(",");
const VIEWPORTS = ONLY ? ALL_VIEWPORTS.filter((v) => ONLY.includes(v.label)) : ALL_VIEWPORTS;

const settle = (page: Page) => page.waitForTimeout(900);
const route = (path: string) => async (page: Page) => {
  await page.goto(path);
  await settle(page);
};

// Game screens from the design-parity list (fixtures and mocked API), plus pages it does not cover.
const SCREENS: Array<{ slug: string; go: (page: Page) => Promise<void> }> = [
  ...FRAMES.filter((f) => f.set === "mobile").map((f) => ({ slug: f.slug, go: f.go })),
  { slug: "page-landing", go: route("/") },
  { slug: "page-join", go: route("/join") },
  { slug: "page-create", go: route("/create") },
  { slug: "page-how-to-play", go: route("/how-to-play") },
  { slug: "page-daily", go: route("/daily") },
  { slug: "page-crews", go: route("/crews") },
  { slug: "page-badges", go: route("/badges") },
  { slug: "page-safety", go: route("/safety") },
  { slug: "page-not-found", go: route("/not-a-page") },
];
const ADMIN = ["", "rooms", "users", "packs", "questions", "reports", "inbox", "audit", "settings"];

const rows: string[] = [];
const ROWS = join(OUT, "rows");
mkdirSync(ROWS, { recursive: true });

for (const vp of VIEWPORTS) {
  test.describe(vp.label, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.scale ?? 1 });

    for (const s of SCREENS) {
      test(s.slug, async ({ page }) => {
        mkdirSync(join(OUT, vp.label), { recursive: true });
        await s.go(page);
        await shoot(page, vp.label, s.slug);
      });
    }

    test("admin console", async ({ browser, baseURL }) => {
      test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, "needs the local or preview service key");
      mkdirSync(join(OUT, vp.label), { recursive: true });
      const admin = await adminLogin(browser, baseURL!);
      try {
        await admin.page.setViewportSize({ width: vp.width, height: vp.height });
        for (const section of ADMIN) {
          await admin.page.goto(`/admin/${section}`);
          await admin.page.waitForTimeout(1800);
          await shoot(admin.page, vp.label, `admin-${section || "overview"}`);
        }
      } finally {
        await admin.cleanup();
      }
    });
  });
}

async function shoot(page: Page, label: string, slug: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  await page.screenshot({ path: join(OUT, label, `${slug}.png`), fullPage: true, animations: "disabled" });
  writeFileSync(join(ROWS, `${label}-${slug}.json`), JSON.stringify({ label, slug, overflow }));
}

test.afterAll(() => {
  for (const f of readdirSync(ROWS)) rows.push(readFileSync(join(ROWS, f), "utf8"));
  const all = rows.map((r) => JSON.parse(r) as { label: string; slug: string; overflow: number });
  const wide = all.filter((r) => r.overflow > 0);
  writeFileSync(
    join(OUT, "index.json"),
    JSON.stringify({ screens: all.length, sidewaysScroll: wide }, null, 2),
  );
});
