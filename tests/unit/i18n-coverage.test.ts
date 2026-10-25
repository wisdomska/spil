import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BASE_SCOPE, SCOPES, type Scope } from "@/lib/i18n/pick";

/**
 * SPIL-07: every message namespace a route's client components use must be in that route's
 * scope, or the page would show raw keys. Walks the import graph from each route's client entry
 * points and collects useTranslations("ns") namespaces and full keys read through useTranslations().
 */
const ROOT = resolve(__dirname, "../..");

const ENTRIES: Record<Scope | "base", string[]> = {
  base: [
    "components/site/SiteHeader.tsx",
    "components/site/ErrorScreen.tsx",
    "components/ui/Toast.tsx",
    "app/error.tsx",
  ],
  landing: ["components/landing/HeroDemo.tsx", "components/landing/ShareDemo.tsx"],
  create: ["app/create/CreateRoom.tsx"],
  join: ["app/join/JoinForm.tsx"],
  profile: ["app/r/[code]/me/ProfileForm.tsx"],
  room: ["components/room/RoomApp.tsx"],
  tv: ["components/tv/TvApp.tsx"],
  daily: ["components/daily/DailySpill.tsx"],
  contact: ["app/contact/ContactForm.tsx"],
  adminAuth: ["components/admin/LoginForm.tsx", "components/admin/ResetForm.tsx"],
  admin: ["components/admin/ConsoleShell.tsx"],
};

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/")
    ? join(ROOT, spec.slice(2))
    : spec.startsWith(".")
      ? resolve(dirname(from), spec)
      : null;
  if (!base) return null;
  for (const ext of ["", ".tsx", ".ts", "/index.ts", "/index.tsx"])
    if (existsSync(base + ext) && !(base + ext).endsWith("/") && /\.tsx?$/.test(base + ext))
      return base + ext;
  return null;
}

/** Namespaces and keys used by the client code reachable from `entries`. */
function usedPaths(entries: string[]): Set<string> {
  const seen = new Set<string>();
  const used = new Set<string>();
  const stack = entries.map((e) => join(ROOT, e));
  while (stack.length) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const src = readFileSync(file, "utf8");
    // Server-only modules never reach the client bundle.
    if (/^import "server-only"/m.test(src)) continue;
    for (const m of src.matchAll(/useTranslations\("([^"]+)"\)/g)) used.add(m[1]!);
    if (/useTranslations\(\)/.test(src)) {
      for (const m of src.matchAll(/\bt\("([a-zA-Z]+(?:\.[a-zA-Z]+)+)"/g)) used.add(m[1]!);
      for (const m of src.matchAll(/\bt\(`([a-zA-Z]+)\./g)) used.add(m[1]!);
    }
    for (const m of src.matchAll(/from "([^"]+)"/g)) {
      const next = resolveImport(file, m[1]!);
      if (next && !next.includes("node_modules")) stack.push(next);
    }
  }
  return used;
}

// A namespace hook on a parent of picked sub-namespaces (the admin sign-in reads "admin" for
// a handful of keys under admin.login, admin.reset and admin.common) counts as covered.
const covered = (path: string, scope: readonly string[]) =>
  scope.some((s) => path === s || path.startsWith(s + ".") || s.startsWith(path + "."));

describe("every route's client copy is in its scope (SPIL-07)", () => {
  for (const [scope, entries] of Object.entries(ENTRIES)) {
    it(scope, () => {
      const allowed = [...BASE_SCOPE, ...(scope === "base" ? [] : SCOPES[scope as Scope])];
      const missing = [...usedPaths(entries)].filter((p) => !covered(p, allowed));
      expect(missing).toEqual([]);
    });
  }
});
