#!/usr/bin/env node
// Gzipped JavaScript each page loads up front (the <script src> tags in its HTML).
// Usage: node scripts/measure-js.mjs http://localhost:3000 home join r/ABCD  ("home" is /)
import { gzipSync } from "node:zlib";

const [base, ...paths] = process.argv.slice(2);
const cache = new Map();

async function size(url) {
  if (!cache.has(url)) {
    const body = Buffer.from(await (await fetch(url)).arrayBuffer());
    cache.set(url, gzipSync(body, { level: 9 }).length);
  }
  return cache.get(url);
}

for (const path of paths) {
  const url = new URL(path === "home" ? "/" : `/${path.replace(/^\//, "")}`, base);
  const html = await (await fetch(url)).text();
  const scripts = [
    ...new Set([...html.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"/g)].map((m) => m[1])),
  ];
  let total = 0;
  for (const src of scripts) total += await size(new URL(src, base).href);
  console.log(
    `${path.padEnd(16)} ${(total / 1024).toFixed(1)} KB gzip in ${scripts.length} scripts`,
  );
}
