import {
  BookOpenIcon,
  DropIcon,
  EyeIcon,
  HandsPrayingIcon,
  HorseIcon,
  QuestionIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import type { AwardId } from "@/lib/game";
import { cn } from "@/lib/cn";

/** Sticker rotation list from the prototype; only stickers rotate (HANDOFF rule 4). */
export const STICKER_ROT = [-3, 2, -1.5, 3.5, -4, 1, 2.5, -2] as const;
export const stickerRot = (i: number) => STICKER_ROT[((i % 8) + 8) % 8]!;

export type LabelName =
  "Fresh Out The Box" | "Mostly Innocent" | "Been Around" | "Main Character" | "Legendary Menace";

const LABEL_LOOK: Record<
  LabelName,
  { bg: string; fg: string; radius: string; stretch: number; caps?: boolean }
> = {
  "Fresh Out The Box": {
    bg: "var(--inverse)",
    fg: "var(--on-inverse)",
    radius: "10px",
    stretch: 100,
  },
  "Mostly Innocent": {
    bg: "var(--surface-raised)",
    fg: "var(--text)",
    radius: "999px",
    stretch: 100,
  },
  "Been Around": {
    bg: "var(--accent)",
    fg: "var(--on-accent)",
    radius: "4px 16px 4px 16px",
    stretch: 100,
  },
  "Main Character": { bg: "var(--accent)", fg: "var(--on-accent)", radius: "999px", stretch: 80 },
  "Legendary Menace": {
    bg: "var(--inverse)",
    fg: "var(--on-inverse)",
    radius: "10px",
    stretch: 75,
    caps: true,
  },
};

/** Style for a score label sticker at a given font size, port of the prototype's stk(). */
export function labelStickerStyle(
  label: LabelName,
  rotate: number,
  fontSize = 18,
): React.CSSProperties {
  const look = LABEL_LOOK[label];
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: `${Math.round(fontSize * 0.5)}px ${Math.round(fontSize * 0.8)}px`,
    background: look.bg,
    color: look.fg,
    border: `${Math.max(3, Math.round(fontSize * 0.2))}px solid var(--sticker-edge)`,
    borderRadius: look.radius,
    boxShadow: "0 0 0 1.5px var(--sticker-ring), 0 8px 16px -10px var(--shadow)",
    fontFamily: "var(--font-display)",
    fontWeight: 800,
    fontSize,
    lineHeight: 1,
    fontStretch: `${look.stretch}%`,
    textTransform: look.caps ? "uppercase" : "none",
    transform: `rotate(${rotate}deg)`,
    whiteSpace: "nowrap",
  };
}

export function LabelSticker({
  label,
  rotate = -4,
  fontSize = 18,
  className,
  style,
}: {
  label: LabelName;
  rotate?: number;
  fontSize?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span className={className} style={{ ...labelStickerStyle(label, rotate, fontSize), ...style }}>
      {label}
    </span>
  );
}

export type AwardKey = AwardId;

export const AWARD_LOOK: Record<
  AwardKey,
  { name: string; Icon: Icon; tone: "accent" | "inverse" | "raised"; shape: "circle" | "rounded" }
> = {
  top_spiller: { name: "Top Spiller", Icon: DropIcon, tone: "accent", shape: "circle" },
  saint_of_the_room: {
    name: "Saint of the Room",
    Icon: HandsPrayingIcon,
    tone: "inverse",
    shape: "rounded",
  },
  mind_reader: { name: "Mind Reader", Icon: EyeIcon, tone: "raised", shape: "circle" },
  dark_horse: { name: "Dark Horse", Icon: HorseIcon, tone: "inverse", shape: "circle" },
  open_book: { name: "Open Book", Icon: BookOpenIcon, tone: "accent", shape: "rounded" },
  clueless: { name: "Clueless", Icon: QuestionIcon, tone: "raised", shape: "circle" },
};

export const AWARD_ORDER: AwardKey[] = [
  "top_spiller",
  "saint_of_the_room",
  "mind_reader",
  "dark_horse",
  "open_book",
  "clueless",
];

export const TONE = {
  accent: ["var(--accent)", "var(--on-accent)"],
  inverse: ["var(--inverse)", "var(--on-inverse)"],
  raised: ["var(--surface-raised)", "var(--text)"],
} as const;

/** Small award sticker used in results lists (60 px). */
export function AwardBadge({
  award,
  index = 0,
  size = 60,
}: {
  award: AwardKey;
  index?: number;
  size?: number;
}) {
  const look = AWARD_LOOK[award];
  const [bg, fg] = TONE[look.tone];
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center border-4 border-sticker-edge"
      style={{
        width: size,
        height: size,
        background: bg,
        color: fg,
        borderRadius: look.shape === "circle" ? "50%" : 16,
        boxShadow: "0 0 0 1.5px var(--sticker-ring)",
        transform: `rotate(${stickerRot(index)}deg)`,
      }}
    >
      <look.Icon size={Math.round(size * 0.4)} />
    </span>
  );
}

/** The big ceremonial award sticker on the reveal stage (210 px, slap 520 ms). */
export function AwardSticker({
  award,
  index,
  animate = true,
}: {
  award: AwardKey;
  index: number;
  animate?: boolean;
}) {
  const look = AWARD_LOOK[award];
  const [bg, fg] = TONE[look.tone];
  return (
    <span
      className={cn(
        "flex size-[210px] shrink-0 flex-col items-center justify-center gap-2.5 self-start border-8 border-sticker-edge p-[18px] text-center font-display text-[26px] leading-[1.02] font-extrabold",
        animate && "animate-slap-award",
      )}
      style={{
        background: bg,
        color: fg,
        borderRadius: look.shape === "circle" ? "50%" : 40,
        boxShadow: "0 0 0 2px var(--sticker-ring), 0 20px 30px -16px var(--shadow)",
        transform: `rotate(${stickerRot(index) * 1.3}deg)`,
      }}
    >
      <look.Icon size={56} aria-hidden />
      {look.name}
    </span>
  );
}
