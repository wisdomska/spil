#!/usr/bin/env node
// Tells IndexNow search engines (Bing, Yandex, Seznam, Naver) about every page in the sitemap,
// so new and changed pages are crawled within hours. Google does not use IndexNow.
// The key is public by design: search engines check it at /<key>.txt on the site.
// Usage: node scripts/indexnow.mjs https://spil-party.vercel.app
const KEY = "65a87a8063752ada639304feb9226dfb";
const site = (process.argv[2] ?? "https://spil-party.vercel.app").replace(/\/$/, "");
const host = new URL(site).host;

const sitemap = await (await fetch(`${site}/sitemap.xml`)).text();
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (urlList.length === 0) {
  console.log("::warning::the sitemap lists no pages; nothing sent to IndexNow");
  process.exit(0);
}

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host, key: KEY, keyLocation: `${site}/${KEY}.txt`, urlList }),
});
// 200 and 202 mean accepted. Anything else is reported but never fails a deploy: IndexNow only
// speeds up crawling, and the sitemap still covers every page.
const ok = res.status === 200 || res.status === 202;
console.log(
  `${ok ? "" : "::warning::"}IndexNow answered ${res.status} for ${urlList.length} pages`,
);
