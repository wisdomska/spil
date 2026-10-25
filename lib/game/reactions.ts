/**
 * Live reactions during the reveal (Batch 2): a few fixed emoji anyone in the room can send.
 * They are broadcast on the room channel and never stored. The database checks the same list.
 */
export const REACTIONS = ["😂", "😱", "🔥", "👀", "🫣", "💀"] as const;
export type Reaction = (typeof REACTIONS)[number];

export function isReaction(value: unknown): value is Reaction {
  return typeof value === "string" && (REACTIONS as readonly string[]).includes(value);
}

/** How many floating reactions a phone keeps on screen at once. */
export const MAX_FLOATING = 24;
