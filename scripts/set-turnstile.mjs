#!/usr/bin/env node
// Turns on Cloudflare Turnstile (bot protection for creating rooms and the contact form) in
// production. Asks for the site key and the secret key in this terminal (the secret is hidden),
// checks the secret with Cloudflare, then stores both as Vercel production environment variables.
// Staging and PR previews stay without it (their addresses are not registered with Turnstile).
// Redeploy production afterwards so the site key reaches the browser.
//
// Usage, from the project folder:
//   node scripts/set-turnstile.mjs --token-file <file holding a Vercel token>
// or set VERCEL_TOKEN in the environment instead of --token-file.
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";

const PROJECT = "prj_cwJQqhjuzqhC9yZ976eMHP9XZJxs";
const TEAM = "team_HrjZ5Xd6USZjC2FoppvW5OCE";

function fail(message) {
  console.error(`set-turnstile: ${message}`);
  process.exit(1);
}

const fileFlag = process.argv.indexOf("--token-file");
const token =
  fileFlag > 0
    ? readFileSync(process.argv[fileFlag + 1], "utf8").trim()
    : process.env.VERCEL_TOKEN?.trim();
if (!token) fail("pass --token-file or set VERCEL_TOKEN");

/** Reads a line; with hidden=true nothing is echoed. */
function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden)
      rl._writeToOutput = (text) => {
        if (text.includes(question)) process.stdout.write(text);
      };
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

const siteKey = await ask("Turnstile site key: ");
if (!/^0x[0-9A-Za-z_-]{10,}$/.test(siteKey))
  fail("that does not look like a site key (it starts with 0x)");
const secret = await ask("Turnstile secret key (hidden): ", true);
if (!/^0x[0-9A-Za-z_-]{10,}$/.test(secret))
  fail("that does not look like a secret key (it starts with 0x)");

// A dummy response tells a valid secret ("invalid-input-response") from a wrong one.
const check = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
  method: "POST",
  body: new URLSearchParams({ secret, response: "spil-setup-check" }),
}).then((r) => r.json());
if (check["error-codes"]?.includes("invalid-input-secret"))
  fail("Cloudflare rejected that secret key; nothing changed");

async function upsert(key, value, type) {
  const res = await fetch(
    `https://api.vercel.com/v10/projects/${PROJECT}/env?upsert=true&teamId=${TEAM}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ key, value, type, target: ["production"] }),
    },
  );
  if (!res.ok) fail(`Vercel refused ${key} (${res.status})`);
}
await upsert("NEXT_PUBLIC_TURNSTILE_SITE_KEY", siteKey, "plain");
await upsert("TURNSTILE_SECRET_KEY", secret, "sensitive");
console.log("Saved both keys for production. Tell Claude to redeploy, or push to main.");
