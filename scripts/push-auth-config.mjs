#!/usr/bin/env node
// Pushes supabase/config.toml (auth settings, email templates) to a hosted project with that
// project's site URL, without editing the local config.
// Usage: SUPABASE_BIN=supabase node scripts/push-auth-config.mjs <preview|production> [--with-templates]
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TARGETS = {
  preview: { ref: "cambebifktqgnbthumzq", site: "https://spil-party-preview.vercel.app" },
  production: { ref: "vhrtnirvvkiybxjufmsm", site: "https://spil-party.vercel.app" },
};

const target = TARGETS[process.argv[2]];
if (!target) {
  console.error("usage: push-auth-config.mjs <preview|production>");
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), "spil-auth-"));
try {
  cpSync("supabase", join(dir, "supabase"), {
    recursive: true,
    filter: (src) => !/[\\/](\.temp|\.branches|migrations|tests)([\\/]|$)/.test(src),
  });
  const file = join(dir, "supabase", "config.toml");
  const config = readFileSync(file, "utf8")
    .replace(/^site_url = .*$/m, `site_url = "${target.site}"`)
    .replace(
      /^additional_redirect_urls = .*$/m,
      `additional_redirect_urls = ["${target.site}/**", "https://spil-party.vercel.app/**", "https://*-spil-party*.vercel.app/**", "http://localhost:3000/**"]`,
    );
  // Free projects on the default email provider reject template changes; push them only once
  // custom SMTP is configured (pass --with-templates).
  const withTemplates = process.argv.includes("--with-templates");
  writeFileSync(
    file,
    withTemplates ? config : config.replace(/\n\[auth\.email\.template\.recovery\][^[]*/, "\n"),
  );
  execFileSync(
    process.env.SUPABASE_BIN ?? "supabase",
    ["config", "push", "--project-ref", target.ref, "--workdir", dir, "--yes"],
    { stdio: "inherit" },
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
