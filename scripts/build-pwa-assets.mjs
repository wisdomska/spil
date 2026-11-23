#!/usr/bin/env node
// Installed-app assets (owner request 2026-11-23): the 192 px maskable icon, the monochrome
// notification badge (Android shows it in the status bar) and the iPhone and iPad launch
// screens listed in lib/pwa/splash.ts. Rendered from app/icon.svg with Playwright, like
// scripts/build-icons.mjs. Run: node scripts/build-pwa-assets.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const svg = readFileSync("app/icon.svg", "utf8");
const bg = svg.match(/<rect[^>]*fill="([^"]+)"/)[1];
const inner = svg
  .replace(/<svg[^>]*>/, "")
  .replace("</svg>", "")
  .replace(/<rect[^>]*\/>/, "");
const mark = (fill) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${fill ? `<rect width="64" height="64" fill="${fill}"/>` : ""}${inner}</svg>`;
// The badge is a silhouette: Android paints it in one colour.
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g transform="rotate(-12 32 30)"><path d="M14 14h36a6 6 0 0 1 6 6v15a6 6 0 0 1-6 6H30l-10 9v-9h-6a6 6 0 0 1-6-6V20a6 6 0 0 1 6-6z" fill="#fff"/></g><path d="M13 52h4a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4z" fill="#fff"/></svg>`;

const screens = readFileSync("lib/pwa/splash.ts", "utf8")
  .matchAll(/\{ w: (\d+), h: (\d+), dpr: (\d) \}/g)
  .map(([, w, h, dpr]) => ({ w: +w, h: +h, dpr: +dpr }))
  .toArray();

const browser = await chromium.launch();
const page = await browser.newPage();
async function shot(html, width, height, transparent = false) {
  await page.setViewportSize({ width, height });
  await page.setContent(
    `<style>html,body{margin:0;height:100%;background:${transparent ? "transparent" : bg}}</style>${html}`,
  );
  return page.screenshot({ omitBackground: transparent, fullPage: false });
}

// Maskable 192: full bleed, the mark inside the central 80 %.
const maskable192 = await shot(
  `<div style="width:192px;height:192px;display:grid;place-items:center;background:${bg}"><div style="width:154px;height:154px">${mark()}</div></div>`,
  192,
  192,
);
const badge96 = await shot(
  `<div style="width:96px;height:96px;padding:8px;box-sizing:border-box">${badge}</div>`,
  96,
  96,
  true,
);
mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-maskable-192.png", maskable192);
writeFileSync("public/icons/badge-96.png", badge96);

mkdirSync("public/splash", { recursive: true });
for (const s of screens) {
  const W = s.w * s.dpr;
  const H = s.h * s.dpr;
  const size = Math.round(Math.min(W, H) * 0.28);
  const png = await shot(
    `<div style="width:${W}px;height:${H}px;display:grid;place-items:center"><div style="width:${size}px;height:${size}px">${mark()}</div></div>`,
    W,
    H,
  );
  writeFileSync(`public/splash/splash-${W}x${H}.png`, png);
}
await browser.close();
console.log(`wrote public/icons (maskable 192, badge 96) and ${screens.length} launch screens`);
