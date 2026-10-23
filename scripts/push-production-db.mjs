#!/usr/bin/env node
// First-time setup of spil-prod: applies every migration and loads the packs and questions from
// supabase/seed.sql, with the local-only flags turned off (no test players in production).
// Later releases only need `supabase db push --linked` (the deploy workflow does that).
// Usage: SUPABASE_BIN=supabase node scripts/push-production-db.mjs
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REF = "vhrtnirvvkiybxjufmsm";
const bin = process.env.SUPABASE_BIN ?? "supabase";
const dir = mkdtempSync(join(tmpdir(), "spil-prod-"));
try {
  cpSync("supabase", join(dir, "supabase"), {
    recursive: true,
    filter: (src) => !/[\\/](\.temp|\.branches|tests)([\\/]|$)/.test(src),
  });
  const seed = join(dir, "supabase", "seed.sql");
  const prod = readFileSync(seed, "utf8").replace(
    "('test_players', true)",
    "('test_players', false)",
  );
  if (!prod.includes("('test_players', false)"))
    throw new Error("seed flags changed; update this script");
  writeFileSync(seed, prod);
  const run = (args) => execFileSync(bin, [...args, "--workdir", dir], { stdio: "inherit" });
  run(["link", "--project-ref", REF]);
  run(["db", "push", "--linked", "--include-seed", "--yes"]);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
