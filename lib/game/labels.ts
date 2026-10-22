export type LabelId =
  "fresh_out_the_box" | "mostly_innocent" | "been_around" | "main_character" | "legendary_menace";

export type StickerTone = "ink" | "raised" | "accent";
export type StickerShape = "square" | "pill" | "tag";

export interface LabelSticker {
  tone: StickerTone;
  shape: StickerShape;
  /** Condensed type (font-stretch below 100%). */
  condensed: boolean;
  /** Uppercase text. */
  caps: boolean;
}

export interface SpillLabel {
  id: LabelId;
  name: string;
  min: number;
  max: number;
  sticker: LabelSticker;
}

/** Score bands from TECH_SPEC 13.3 and HANDOFF. Ranges are inclusive and cover 0 to 100. */
export const LABELS: readonly SpillLabel[] = [
  {
    id: "fresh_out_the_box",
    name: "Fresh Out The Box",
    min: 0,
    max: 15,
    sticker: { tone: "ink", shape: "square", condensed: false, caps: false },
  },
  {
    id: "mostly_innocent",
    name: "Mostly Innocent",
    min: 16,
    max: 35,
    sticker: { tone: "raised", shape: "pill", condensed: false, caps: false },
  },
  {
    id: "been_around",
    name: "Been Around",
    min: 36,
    max: 55,
    sticker: { tone: "accent", shape: "tag", condensed: false, caps: false },
  },
  {
    id: "main_character",
    name: "Main Character",
    min: 56,
    max: 75,
    sticker: { tone: "accent", shape: "pill", condensed: true, caps: false },
  },
  {
    id: "legendary_menace",
    name: "Legendary Menace",
    min: 76,
    max: 100,
    sticker: { tone: "ink", shape: "square", condensed: true, caps: true },
  },
];

/** Label for a score. Fractions are rounded and out-of-range scores clamped to 0 to 100. */
export function labelFor(score: number): SpillLabel {
  if (!Number.isFinite(score)) throw new RangeError(`Score must be a finite number: ${score}`);
  const s = Math.min(100, Math.max(0, Math.round(score)));
  const label = LABELS.find((l) => s >= l.min && s <= l.max);
  /* v8 ignore next */
  if (!label) throw new Error(`No label covers ${s}`);
  return label;
}

export function labelById(id: LabelId): SpillLabel {
  const label = LABELS.find((l) => l.id === id);
  if (!label) throw new RangeError(`Unknown label: ${id}`);
  return label;
}
