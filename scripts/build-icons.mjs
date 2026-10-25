#!/usr/bin/env node
// Renders app/icon.svg (the Spilled Bubble favicon) into the raster fallbacks Next serves:
// app/favicon.ico (16 and 32 px PNGs inside an ICO) and app/apple-icon.png (180 px, full bleed,
// since iOS rounds the corners itself), plus the web app manifest icons in public/icons (SPIL-30):
// 192 and 512 px, and a 512 px maskable one with the mark inside the 80 % safe zone.
// Run after changing app/icon.svg: node scripts/build-icons.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const svg = readFileSync("app/icon.svg", "utf8");
const fullBleed = svg.replace('rx="15" ', "");

const browser = await chromium.launch();
const page = await browser.newPage();
async function render(source, px) {
  await page.setViewportSize({ width: px, height: px });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${px}px;height:${px}px}</style>${source}`,
  );
  return page.locator("svg").screenshot({ omitBackground: true });
}

const png16 = await render(svg, 16);
const png32 = await render(svg, 32);
const apple = await render(fullBleed, 180);
const icon192 = await render(svg, 192);
const icon512 = await render(svg, 512);
// Maskable: the background fills the square and the mark shrinks into the central 80 %.
const bg = svg.match(/<rect[^>]*fill="([^"]+)"/)[1];
const maskable = await render(
  fullBleed
    .replace(
      /<rect[^>]*\/>/,
      `<rect width="64" height="64" fill="${bg}"/><g transform="translate(6.4 6.4) scale(.8)">`,
    )
    .replace("</svg>", "</g></svg>"),
  512,
);
await browser.close();

// ICO container holding PNG images (supported by every current browser).
const images = [
  [16, png16],
  [32, png32],
];
const header = Buffer.alloc(6 + 16 * images.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach(([size, data], i) => {
  const at = 6 + 16 * i;
  header.writeUInt8(size, at);
  header.writeUInt8(size, at + 1);
  header.writeUInt8(0, at + 2);
  header.writeUInt8(0, at + 3);
  header.writeUInt16LE(1, at + 4);
  header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(data.length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += data.length;
});
writeFileSync("app/favicon.ico", Buffer.concat([header, ...images.map(([, d]) => d)]));
writeFileSync("app/apple-icon.png", apple);
mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", icon192);
writeFileSync("public/icons/icon-512.png", icon512);
writeFileSync("public/icons/icon-maskable-512.png", maskable);
console.log("wrote app/favicon.ico, app/apple-icon.png and public/icons");
