import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type Browser } from "@playwright/test";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { FRAMES, type Frame } from "./frames";

/**
 * Design parity (QA step 7): screenshot every frame in design/SPIL Screens *.dc.html and the same
 * state in the app at the same size and theme, then diff them. Writes reference/, actual/,
 * diff/ and report.json under tests/visual. Run: DESIGN_URL=http://localhost:4500 pnpm test:visual
 */
const DESIGN = process.env.DESIGN_URL ?? "http://localhost:4500";
const OUT = "tests/visual";
const SETS = {
  mobile: { file: { dark: "SPIL Screens Mobile Dark.dc.html", light: "SPIL Screens Mobile Light.dc.html" }, size: { width: 390, height: 844 } },
  desktop: { file: { dark: "SPIL Screens Desktop.dc.html", light: null }, size: { width: 1280, height: 800 } },
} as const;

type Row = { set: string; theme: string; caption: string; slug: string; diffRatio: number | null; note?: string };
// One file per frame, so a failed test (which restarts the worker) never loses earlier rows.
const ROWS = join(OUT, "rows");
const record = (row: Row) => writeFileSync(join(ROWS, `${row.set}-${row.theme}-${row.slug}.json`), JSON.stringify(row));

for (const dir of ["reference", "actual", "diff", "rows"]) mkdirSync(join(OUT, dir), { recursive: true });

async function reference(browser: Browser, file: string, caption: string) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`${DESIGN}/${encodeURIComponent(file)}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const figure = page.locator("figure").filter({ has: page.locator("figcaption", { hasText: new RegExp(`^${caption.replace(/[()+]/g, "\\$&")}$`) }) }).first();
  const box = figure.locator(":scope > div").first();
  await box.scrollIntoViewIfNeeded();
  // Frames render lazily; wait until the capture is more than a flat background.
  let img = PNG.sync.read(await box.screenshot({ animations: "disabled" }));
  for (let i = 0; i < 12 && isFlat(img); i++) {
    await page.waitForTimeout(800);
    await box.scrollIntoViewIfNeeded();
    img = PNG.sync.read(await box.screenshot({ animations: "disabled" }));
  }
  await ctx.close();
  return img;
}

function isFlat(img: PNG) {
  const seen = new Set<number>();
  for (let i = 0; i < img.data.length; i += 4 * 97) {
    seen.add((img.data[i]! << 16) | (img.data[i + 1]! << 8) | img.data[i + 2]!);
    if (seen.size > 12) return false;
  }
  return true;
}

async function actual(browser: Browser, frame: Frame, theme: "dark" | "light", size: { width: number; height: number }) {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await ctx.addInitScript((t) => localStorage.setItem("spil-theme", t), theme);
  const page = await ctx.newPage();
  await frame.go(page);
  const png = await page.screenshot({ animations: "disabled" });
  await ctx.close();
  return PNG.sync.read(png);
}

function compare(a: PNG, b: PNG) {
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);
  const crop = (img: PNG) => {
    const out = new PNG({ width, height });
    PNG.bitblt(img, out, 0, 0, width, height, 0, 0);
    return out;
  };
  const ca = crop(a);
  const cb = crop(b);
  const diff = new PNG({ width, height });
  const n = pixelmatch(ca.data, cb.data, diff.data, width, height, { threshold: 0.15 });
  return { ratio: n / (width * height), diff };
}

for (const theme of ["dark", "light"] as const) {
  for (const frame of FRAMES) {
    const set = SETS[frame.set];
    const file = set.file[theme];
    if (!file) continue;
    test(`${frame.set} ${theme}: ${frame.caption}`, async ({ browser }) => {
      const name = `${frame.set}-${theme}-${frame.slug}.png`;
      try {
        const ref = await reference(browser, file, frame.caption);
        const app = await actual(browser, frame, theme, set.size);
        writeFileSync(join(OUT, "reference", name), PNG.sync.write(ref));
        writeFileSync(join(OUT, "actual", name), PNG.sync.write(app));
        const { ratio, diff } = compare(ref, app);
        writeFileSync(join(OUT, "diff", name), PNG.sync.write(diff));
        record({ set: frame.set, theme, caption: frame.caption, slug: frame.slug, diffRatio: Number(ratio.toFixed(4)) });
      } catch (error) {
        record({ set: frame.set, theme, caption: frame.caption, slug: frame.slug, diffRatio: null, note: String(error).slice(0, 200) });
        throw error;
      }
    });
  }
}

test.afterAll(() => {
  const rows = readdirSync(ROWS).map((f) => JSON.parse(readFileSync(join(ROWS, f), "utf8")) as Row);
  rows.sort((a, b) => (b.diffRatio ?? 1) - (a.diffRatio ?? 1));
  writeFileSync(join(OUT, "report.json"), JSON.stringify(rows, null, 2));
});
