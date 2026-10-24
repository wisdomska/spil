/**
 * Age bands (SPIL-02). A player types their age on their own device; only the band ever leaves
 * it. Packs have a minimum age of 13, 16 or 18, and a player sees a pack only when their band's
 * floor reaches it.
 */
export const AGE_BANDS = ["13_15", "16_17", "18_plus"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];
/** What the age screen can produce; under_13 never gets past it. */
export type AgeResult = AgeBand | "under_13";

export const MIN_AGES = [13, 16, 18] as const;
export type MinAge = (typeof MIN_AGES)[number];

/** Ages the age screen accepts; anything else is "Enter your real age." */
export function isRealAge(age: number): boolean {
  return Number.isInteger(age) && age >= 1 && age <= 99;
}

export function toBand(age: number): AgeResult {
  if (age < 13) return "under_13";
  if (age <= 15) return "13_15";
  if (age <= 17) return "16_17";
  return "18_plus";
}

/** The youngest age in a band: 13, 16 or 18. */
export function bandFloor(band: AgeBand): MinAge {
  return band === "13_15" ? 13 : band === "16_17" ? 16 : 18;
}

export function isAgeBand(value: unknown): value is AgeBand {
  return typeof value === "string" && (AGE_BANDS as readonly string[]).includes(value);
}

/** A room's floor is its youngest player's; an empty room is open to every band. */
export function youngestFloor(bands: readonly AgeBand[]): MinAge {
  return bands.reduce<MinAge>((min, b) => (bandFloor(b) < min ? bandFloor(b) : min), 18);
}

/**
 * Packs a floor may see. With the "18+ packs" flag off, 18+ packs are hidden for everyone.
 * Under-18 players never get adult packs at all, so nothing about them reaches the device.
 */
export function packsForFloor<P extends { minAge: number }>(
  packs: readonly P[],
  floor: MinAge,
  adultEnabled: boolean,
): P[] {
  return packs.filter((p) => p.minAge <= floor && (adultEnabled || p.minAge < 18));
}
