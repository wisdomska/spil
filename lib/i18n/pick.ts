/**
 * Picks message namespaces for one route's client components (SPIL-07). Paths are top-level
 * namespaces ("room") or dotted sub-namespaces ("pages.contactPage"); unknown paths are skipped.
 * Pure, so the scopes can be tested without rendering.
 */
type Messages = Record<string, unknown>;

export function pickMessages(all: Messages, paths: readonly string[]): Messages {
  const out: Messages = {};
  for (const path of paths) {
    const keys = path.split(".");
    let from: unknown = all;
    for (const k of keys) from = (from as Messages | undefined)?.[k];
    if (from === undefined) continue;
    let into = out;
    keys.slice(0, -1).forEach((k) => {
      into[k] = typeof into[k] === "object" && into[k] !== null ? into[k] : {};
      into = into[k] as Messages;
    });
    into[keys[keys.length - 1]!] = from;
  }
  return out;
}

/** Every page: the site header, sheets, toasts and error screens. */
export const BASE_SCOPE = ["common", "toast", "error"] as const;

/** Client namespaces per route. The admin console alone gets "admin", after its session check. */
export const SCOPES = {
  landing: ["landing", "awards", "card"],
  create: ["age", "packs", "packInfo", "question", "modes"],
  join: ["join"],
  profile: ["profile", "age"],
  room: [
    "room",
    "lobby",
    "question",
    "report",
    "waiting",
    "guess",
    "ready",
    "reveal",
    "results",
    "share",
    "card",
    "sheet",
    "labels",
    "awards",
    "modes",
    "landing.headline",
    "landing.headlineEmphasis",
  ],
  contact: ["pages.contactPage"],
  adminAuth: ["admin.badge", "admin.title", "admin.login", "admin.reset", "admin.common"],
  admin: ["admin", "modes"],
} as const satisfies Record<string, readonly string[]>;

export type Scope = keyof typeof SCOPES;
