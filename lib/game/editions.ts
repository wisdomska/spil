/**
 * Editions (owner request 2026-11-24). A few questions only land with people from one place
 * (trotro, owambe, hall week). Each question may carry a region; a room plays one edition:
 *   global: only the questions for everyone
 *   GH:     plus the Ghana and West Africa ones
 *   NG:     plus the Nigeria and West Africa ones
 * The draw itself happens in start_round; these helpers decide what the setup screen offers.
 */
export const EDITIONS = ["global", "GH", "NG"] as const;
export type Edition = (typeof EDITIONS)[number];
export type LocalEdition = Exclude<Edition, "global">;
export type QuestionRegion = "GH" | "NG" | "WA";

export const isEdition = (v: unknown): v is Edition =>
  typeof v === "string" && (EDITIONS as readonly string[]).includes(v);

/** The local editions a pack has questions for, from its questions' regions. */
export function packEditions(regions: Iterable<string | null>): LocalEdition[] {
  let gh = false;
  let ng = false;
  for (const r of regions) {
    if (r === "GH" || r === "WA") gh = true;
    if (r === "NG" || r === "WA") ng = true;
  }
  return [...(gh ? (["GH"] as const) : []), ...(ng ? (["NG"] as const) : [])];
}

/** The edition a country (ISO code, e.g. from the hosting edge) points to. */
export function editionForCountry(country: string | null | undefined): Edition {
  const c = country?.toUpperCase();
  return c === "GH" ? "GH" : c === "NG" ? "NG" : "global";
}

/**
 * The edition to pre-select: the host's last pick when they made one, else the one their
 * country points to, else global. Falls back to global when the pack has no questions for it.
 */
export function defaultEdition(
  available: readonly LocalEdition[],
  saved: Edition | null | undefined,
  country: string | null | undefined,
): Edition {
  const fits = (e: Edition) => e === "global" || available.includes(e);
  if (saved && fits(saved)) return saved;
  const local = editionForCountry(country);
  return fits(local) ? local : "global";
}

/** How many questions each edition plays from these regions (like the draw, never 0 if any). */
export function editionCounts(regions: readonly (string | null)[]): Record<Edition, number> {
  const out = {} as Record<Edition, number>;
  for (const e of EDITIONS)
    out[e] = regions.filter((r) => editionPlays(e, r)).length || regions.length;
  return out;
}

/** Whether a room in `edition` plays a question tagged `region` (mirrors start_round). */
export function editionPlays(edition: Edition, region: string | null): boolean {
  if (region === null) return true;
  if (edition === "GH") return region === "GH" || region === "WA";
  if (edition === "NG") return region === "NG" || region === "WA";
  return false;
}
