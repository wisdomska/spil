#!/usr/bin/env node
// Compares a fresh capture against the baseline, screen by screen, and lists what changed.
// Usage: node tests/visual/compare-baseline.mjs <baselineDir> <newDir> [threshold=0.01]
// Writes <newDir>/diff/<viewport>/<screen>.png for every changed screen and prints a table.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const [base, next, limit = "0.01"] = process.argv.slice(2);
if (!base || !next) {
  console.error("usage: compare-baseline.mjs <baselineDir> <newDir> [threshold]");
  process.exit(1);
}
const changed = [];
for (const vp of readdirSync(base).filter((d) => !d.includes(".") && d !== "rows")) {
  for (const file of readdirSync(join(base, vp)).filter((f) => f.endsWith(".png"))) {
    const after = join(next, vp, file);
    if (!existsSync(after)) {
      changed.push([vp, file, "missing"]);
      continue;
    }
    const a = PNG.sync.read(readFileSync(join(base, vp, file)));
    const b = PNG.sync.read(readFileSync(after));
    const width = Math.min(a.width, b.width);
    const height = Math.min(a.height, b.height);
    const crop = (img) => {
      const out = new PNG({ width, height });
      PNG.bitblt(img, out, 0, 0, width, height, 0, 0);
      return out;
    };
    const diff = new PNG({ width, height });
    const n = pixelmatch(crop(a).data, crop(b).data, diff.data, width, height, { threshold: 0.15 });
    const ratio = n / (width * height) + (a.height !== b.height ? 0.0001 : 0);
    if (ratio > Number(limit)) {
      mkdirSync(join(next, "diff", vp), { recursive: true });
      writeFileSync(join(next, "diff", vp, file), PNG.sync.write(diff));
      changed.push([vp, file, ratio.toFixed(4)]);
    }
  }
}
console.log(changed.length ? changed.map((r) => r.join("\t")).join("\n") : "no visual changes");
