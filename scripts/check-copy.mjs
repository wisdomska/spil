#!/usr/bin/env node
// Fails on em/en dashes in UI copy and on hex colours outside app/styles.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SOURCE = /\.(tsx?|jsx?|css|json)$/;

function walk(dir) {
  let files = [];
  try {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) files = files.concat(walk(path));
      else if (SOURCE.test(name)) files.push(path);
    }
  } catch {
    // directory does not exist yet
  }
  return files;
}

const problems = [];

for (const file of [...walk("messages"), ...walk("components")]) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (/[–—]/.test(line)) problems.push(`${relative(ROOT, file)}:${i + 1} em or en dash`);
    });
}

for (const file of [...walk("app"), ...walk("components")]) {
  if (relative(ROOT, file).replaceAll("\\", "/").startsWith("app/styles/")) continue;
  if (/[\\/]og[\\/]/.test(file)) continue; // OG images render outside the CSS cascade
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (/#[0-9a-fA-F]{3,8}\b/.test(line) && !/^\s*(\/\/|\*)/.test(line))
        problems.push(`${relative(ROOT, file)}:${i + 1} hex colour outside app/styles`);
    });
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
