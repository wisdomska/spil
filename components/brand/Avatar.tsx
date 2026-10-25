export const AVATAR_COUNT = 24;

/**
 * One emoji per avatar, drawn with the device's own emoji font (Apple's on iPhone, Google's on
 * Android, Microsoft's on Windows). All are from Emoji 12 (2019) or earlier so older phones show
 * them too. Index order is stored in the database (players.avatar), so only append, never reorder.
 */
export const AVATAR_EMOJI = [
  "😈",
  "😏",
  "🤭",
  "🙈",
  "🤠",
  "🥳",
  "😎",
  "🤪",
  "😜",
  "🤫",
  "😇",
  "🥵",
  "🤯",
  "🥴",
  "👻",
  "👽",
  "🤡",
  "💀",
  "🤓",
  "😺",
  "🐸",
  "🦊",
  "🐼",
  "🦄",
];
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

type AvatarProps = {
  /** 0 to 23 */
  n: number;
  size?: number;
  selected?: boolean;
  /** Accessible name; pass the player's nickname. Omit with decorative to hide from screen readers. */
  label?: string;
  decorative?: boolean;
  className?: string;
  /** Batch 3: an unlocked frame the player wears. */
  frame?: "none" | "ring" | "accent" | "dashed" | "double";
};

const FRAME_SHADOW = {
  none: "inset 0 0 0 1px var(--avatar-edge)",
  ring: "0 0 0 2px var(--text)",
  accent: "0 0 0 3px var(--accent)",
  dashed: "inset 0 0 0 1px var(--avatar-edge)",
  double:
    "0 0 0 2px var(--bg), 0 0 0 4px var(--accent), 0 0 0 6px var(--bg), 0 0 0 8px var(--text)",
} as const;

/** A player's emoji on the same plain disc for everyone, so the emoji carries the identity. */
export function Avatar({
  n,
  size = 48,
  selected,
  label,
  decorative,
  className,
  frame = "none",
}: AvatarProps) {
  const i = (((Math.trunc(n) || 0) % AVATAR_COUNT) + AVATAR_COUNT) % AVATAR_COUNT;
  return (
    <span
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : (label ?? `Avatar ${i + 1}`)}
      aria-hidden={decorative || undefined}
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        background: "var(--surface-raised)",
        boxShadow: selected ? "0 0 0 3px var(--bg), 0 0 0 6px var(--accent)" : FRAME_SHADOW[frame],
        outline: !selected && frame === "dashed" ? "2px dashed var(--accent)" : undefined,
        outlineOffset: !selected && frame === "dashed" ? 2 : undefined,
        fontFamily: EMOJI_FONT,
        fontSize: Math.round(size * 0.62),
        lineHeight: 1,
      }}
    >
      <span aria-hidden>{AVATAR_EMOJI[i]}</span>
    </span>
  );
}
