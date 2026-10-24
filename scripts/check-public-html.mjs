// SPIL-07 CI check: public pages must not carry the admin console's strings.
// Usage: node scripts/check-public-html.mjs http://localhost:3000
const base = process.argv[2] ?? "http://localhost:3000";
const PAGES = [
  "/",
  "/create",
  "/join",
  "/r/TEST",
  "/r/TEST/me",
  "/how-to-play",
  "/contact",
  "/safety",
];
const ADMIN_KEYS = ["dangerBody", "auditNote", "flagSaved"];
let failed = false;
for (const path of PAGES) {
  const html = await (await fetch(base + path)).text();
  const found = ADMIN_KEYS.filter((k) => html.includes(k));
  console.log(
    `${path.padEnd(14)} ${String(html.length).padStart(7)} bytes ${found.length ? `ADMIN STRINGS: ${found.join(", ")}` : "ok"}`,
  );
  if (found.length) failed = true;
}
process.exit(failed ? 1 : 0);
