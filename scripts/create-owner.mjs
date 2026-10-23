#!/usr/bin/env node
// One-off: makes INITIAL_OWNER_EMAIL the first admin (role owner).
// Creates the auth user (or finds it) with the service role and a random password that is never
// printed, then upserts the `admins` row. The owner sets a real password through /admin/reset.
//
// Usage: INITIAL_OWNER_EMAIL=you@example.com node scripts/create-owner.mjs [--name "Your Name"]
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment, falling back
// to .env.local. Run it once per Supabase project (local, staging, production).
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.INITIAL_OWNER_EMAIL?.trim().toLowerCase();
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
if (!email || !/^\S+@\S+\.\S+$/.test(email)) fail("set INITIAL_OWNER_EMAIL to the owner's email");
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
console.log("Next: open /admin/reset on the site, enter that email and set a password.");
