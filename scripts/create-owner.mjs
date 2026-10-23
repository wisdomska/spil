#!/usr/bin/env node
// One-off: makes the given email the first admin (role owner).
// Creates the auth user (or finds it) with the service role and a random password that is never
// printed, then upserts the `admins` row. The owner sets a real password through /admin/reset.
//
// Usage (any shell, from the project folder):
//   node scripts/create-owner.mjs --email you@example.com [--name "Your Name"]
//          [--project staging|production] [--set-password]
// --project fetches that project's URL and service key with the logged-in Supabase CLI
// (SUPABASE_BIN, default "supabase"); without it, NEXT_PUBLIC_SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY come from the environment or .env.local.
// --set-password asks for the password in this terminal (hidden, typed twice) and sets it, for
// when the reset email cannot be delivered (Supabase's default sender only mails project members).
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { createClient } from "@supabase/supabase-js";

/** SUPABASE_BIN, else the standalone CLI in ~/bin (Windows setup), else "supabase" on PATH. */
function supabaseBin() {
  if (process.env.SUPABASE_BIN) return process.env.SUPABASE_BIN;
  const local = join(homedir(), "bin", process.platform === "win32" ? "supabase.exe" : "supabase");
  return existsSync(local) ? local : "supabase";
}

const PROJECTS = { staging: "cambebifktqgnbthumzq", production: "vhrtnirvvkiybxjufmsm" };
const flag = (n) => {
  const i = process.argv.indexOf(n);
  return i > 0 ? process.argv[i + 1] : undefined;
};

const project = flag("--project");
let url;
let key;
if (project) {
  const ref = PROJECTS[project];
  if (!ref) {
    console.error("create-owner: --project must be staging or production");
    process.exit(1);
  }
  const keys = JSON.parse(
    execFileSync(supabaseBin(), ["projects", "api-keys", "--project-ref", ref, "-o", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }),
  );
  url = `https://${ref}.supabase.co`;
  key = keys.find((k) => k.name === "service_role")?.api_key;
} else {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
}
// --email works in any shell; INITIAL_OWNER_EMAIL is kept for scripts and CI.
const email = (flag("--email") ?? process.env.INITIAL_OWNER_EMAIL)?.trim().toLowerCase();
const nameFlag = process.argv.indexOf("--name");
const name =
  (nameFlag > 0 ? process.argv[nameFlag + 1] : undefined)?.trim() ||
  process.env.INITIAL_OWNER_NAME?.trim() ||
  "Owner";

function fail(message) {
  console.error(`create-owner: ${message}`);
  process.exit(1);
}

if (!url || !key) fail("set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
if (!email || !/^\S+@\S+\.\S+$/.test(email)) fail("pass --email with the owner's email address");
if (name.length < 2 || name.length > 40) fail("--name must be 2 to 40 characters");

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUser(address) {
  for (let page = 1; page < 100; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`could not list users: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === address);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

let user = await findUser(email);
if (user) {
  console.log("Found the existing auth user for that email.");
} else {
  // Random and never shown: the owner replaces it through the reset flow.
  const password = randomBytes(24).toString("base64url");
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) fail(`could not create the user: ${error?.message}`);
  user = data.user;
  console.log("Created the auth user.");
}

const { error } = await db
  .from("admins")
  .upsert({ user_id: user.id, email, name, role: "owner" }, { onConflict: "user_id" });
if (error) fail(`could not write the admins row: ${error.message}`);

await db.from("audit_log").insert({
  admin_user_id: user.id,
  who: "create-owner script",
  action: "admin_added",
  target: email,
  after: { name, email, role: "owner" },
});

console.log(`${email} is an owner.`);

/** Reads a line without echoing it. */
function ask(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (text) => {
      if (text.includes(question)) process.stdout.write(text);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

if (process.argv.includes("--set-password")) {
  const first = await ask("New password (10+ characters, hidden): ");
  const again = await ask("Same password again: ");
  if (first !== again) fail("the two passwords do not match; nothing changed");
  if (first.length < 10) fail("the password needs at least 10 characters; nothing changed");
  const { error: pwError } = await db.auth.admin.updateUserById(user.id, { password: first });
  if (pwError) fail(`could not set the password: ${pwError.message}`);
  console.log("Password set. Sign in at /admin/login.");
} else {
  console.log("Next: open /admin/reset on the site, enter that email and set a password.");
}
