#!/usr/bin/env node
// Copies Supabase URLs and keys into Vercel env vars without printing them.
// Usage: VERCEL_TOKEN=... SUPABASE_BIN=supabase node scripts/sync-env.mjs <production|preview> <supabase-ref>
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const [target, ref] = process.argv.slice(2);
if (!["production", "preview"].includes(target) || !ref) {
  console.error("usage: sync-env.mjs <production|preview> <supabase-ref>");
  process.exit(1);
}

const PROJECT = "spil-party";
const TEAM = "team_HrjZ5Xd6USZjC2FoppvW5OCE";
const token = process.env.VERCEL_TOKEN;
const supabase = process.env.SUPABASE_BIN ?? "supabase";

const raw = execFileSync(supabase, ["projects", "api-keys", "--project-ref", ref, "-o", "json"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
});
const keys = JSON.parse(raw.slice(raw.indexOf("[")));
const key = (name) => {
  const row = keys.find((k) => k.name === name);
  if (!row?.api_key) throw new Error(`missing ${name} key`);
  return row.api_key;
};

const site =
  target === "production"
    ? "https://spil-party.vercel.app"
    : "https://spil-party-preview.vercel.app";

const vars = [
  ["NEXT_PUBLIC_SITE_URL", site, "plain"],
  ["APP_ENV", target, "plain"],
  ["NEXT_PUBLIC_SUPABASE_URL", `https://${ref}.supabase.co`, "plain"],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", key("anon"), "plain"],
  ["SUPABASE_SERVICE_ROLE_KEY", key("service_role"), "sensitive"],
  ["CRON_SECRET", randomBytes(32).toString("hex"), "sensitive"],
];

const api = (path, init = {}) =>
  fetch(`https://api.vercel.com${path}${path.includes("?") ? "&" : "?"}teamId=${TEAM}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  }).then((r) => r.json());

const existing = (await api(`/v10/projects/${PROJECT}/env`)).envs ?? [];
for (const [name] of vars) {
  for (const env of existing.filter((e) => e.key === name && e.target.includes(target))) {
    await api(`/v9/projects/${PROJECT}/env/${env.id}`, { method: "DELETE" });
  }
}

for (const [name, value, type] of vars) {
  const res = await api(`/v10/projects/${PROJECT}/env`, {
    method: "POST",
    body: JSON.stringify({ key: name, value, type, target: [target] }),
  });
  console.log(
    `${res.error ? "FAILED" : "set"} ${name} (${target}, ${type})${res.error ? ` ${res.error.message}` : ""}`,
  );
}
