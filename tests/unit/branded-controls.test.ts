import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Owner request 2026-11-12: nothing in SPIL renders in the browser's or OS's own style, on the
 * player side or in the admin console. Dropdowns, checkboxes, dialogs and tooltips go through the
 * branded components in components/ui. This test fails when a native one slips back in.
 */

const ROOT = join(__dirname, "..", "..");
const DIRS = ["app", "components"];
// The branded components themselves, and the dev-only kitchen sink.
const SKIP_DIRS = ["components/ui", "app/dev"];

/** Native controls that are allowed in one place only, with the reason. */
const ALLOWED: Record<string, string[]> = {
  // A visually hidden file input behind our own styled "Choose a file" label.
  'type="file"': ["components/admin/sections/QuestionsSection.tsx"],
};

const RULES: Array<{ name: string; re: RegExp }> = [
  { name: "<select>", re: /<select[\s>]/ },
  { name: "<option>", re: /<option[\s>]/ },
  { name: "<datalist>", re: /<datalist[\s>]/ },
  { name: "<dialog>", re: /<dialog[\s>]/ },
  {
    name: "native input type (checkbox, radio, range, date, time, color, number, file)",
    re: /type="(checkbox|radio|range|date|datetime-local|time|month|week|color|number|file)"/,
  },
  { name: "window.confirm/alert/prompt", re: /(?<![\w.$])(?:window\.)?(confirm|alert|prompt)\(/ },
];

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = relative(ROOT, p);
    if (SKIP_DIRS.some((s) => rel === s || rel.startsWith(`${s}/`))) continue;
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const sources = DIRS.flatMap((d) => files(join(ROOT, d))).map((p) => ({
  rel: relative(ROOT, p),
  text: readFileSync(p, "utf8"),
}));

describe("branded controls only", () => {
  it("finds the source files", () => {
    expect(sources.length).toBeGreaterThan(50);
  });

  for (const rule of RULES) {
    it(`no ${rule.name} outside components/ui`, () => {
      const hits: string[] = [];
      for (const { rel, text } of sources) {
        text.split("\n").forEach((line, i) => {
          const m = line.match(rule.re);
          if (!m) return;
          if (line.trim().startsWith("//") || line.trim().startsWith("*")) return;
          const key = m[0].startsWith("type=") ? `type="${m[1]}"` : m[0];
          if (ALLOWED[key]?.includes(rel)) return;
          hits.push(`${rel}:${i + 1}  ${line.trim()}`);
        });
      }
      expect(hits, "use the branded components in components/ui instead").toEqual([]);
    });
  }

  it("no browser title tooltips on HTML elements (use components/ui/Tooltip)", () => {
    const hits: string[] = [];
    for (const { rel, text } of sources) {
      for (const m of text.matchAll(/\stitle=[{"]/g)) {
        const before = text.slice(0, m.index);
        const open = before.lastIndexOf("<");
        const tag = before.slice(open + 1).match(/^([A-Za-z][\w.]*)/)?.[1];
        // Lower-case tags are HTML elements; components (Sheet, SwitchRow, Section) take a title prop.
        if (tag && /^[a-z]/.test(tag) && tag !== "svg" && tag !== "link" && tag !== "iframe") {
          hits.push(`${rel}:${before.split("\n").length}  <${tag} title=…>`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
