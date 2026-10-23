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
};

/** A player's emoji on the same plain disc for everyone, so the emoji carries the identity. */
export function Avatar({ n, size = 48, selected, label, decorative, className }: AvatarProps) {
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
        boxShadow: selected
          ? "0 0 0 3px var(--bg), 0 0 0 6px var(--accent)"
          : "inset 0 0 0 1px var(--avatar-edge)",
        fontFamily: EMOJI_FONT,
        fontSize: Math.round(size * 0.62),
        lineHeight: 1,
      }}
    >
      <span aria-hidden>{AVATAR_EMOJI[i]}</span>
    </span>
  );
}
