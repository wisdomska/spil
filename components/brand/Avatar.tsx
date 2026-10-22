import type { CSSProperties } from "react";

export const AVATAR_COUNT = 24;

const PALETTES: Array<[string, string]> = [
  ["var(--accent)", "var(--bg)"],
  ["var(--text)", "var(--accent)"],
  ["var(--surface-raised)", "var(--accent)"],
  ["var(--accent)", "var(--text)"],
];
const FACES = [1, 2, 0, 3, 1, 3, 2, 0, 3, 1, 0, 2];

function pattern(n: number, s: number, A: string, B: string) {
  const u = s / 6;
  const z = s / 8;
  const d = s / 4;
  const zig = [135, 225, 315, 45]
    .map(
      (a, i) =>
        `linear-gradient(${a}deg, ${B} 25%, transparent 25%) ${i < 2 ? -z : 0}px 0/${2 * z}px ${2 * z}px`,
    )
    .join(",");
  const patterns = [
    `repeating-linear-gradient(0deg, ${A} 0 ${u}px, ${B} ${u}px ${2 * u}px)`,
    `repeating-linear-gradient(45deg, ${A} 0 ${u * 0.75}px, ${B} ${u * 0.75}px ${u * 1.5}px)`,
    `radial-gradient(circle, ${B} 26%, transparent 28%) 0 0/${d}px ${d}px, ${A}`,
    `${zig}, ${A}`,
    `linear-gradient(90deg, ${A} 50%, ${B} 50%)`,
    `linear-gradient(135deg, ${A} 50%, ${B} 50%)`,
    `repeating-radial-gradient(circle, ${A} 0 ${u * 0.7}px, ${B} ${u * 0.7}px ${u * 1.4}px)`,
    `conic-gradient(${A} 25%, ${B} 0 50%, ${A} 0 75%, ${B} 0) 0 0/${s / 3}px ${s / 3}px`,
    `radial-gradient(circle at 50% 110%, ${A} 48%, ${B} 49%)`,
    `conic-gradient(from 45deg, ${A} 0 25%, ${B} 0 50%, ${A} 0 75%, ${B} 0)`,
    `repeating-linear-gradient(90deg, ${A} 0 ${u}px, ${B} ${u}px ${u * 1.35}px, var(--bg) ${u * 1.35}px ${u * 1.7}px, ${B} ${u * 1.7}px ${u * 2.05}px)`,
    `radial-gradient(circle, ${A} 22%, transparent 24%) 0 0/${d}px ${d}px, repeating-linear-gradient(0deg, ${B} 0 ${d / 2}px, var(--surface-raised) ${d / 2}px ${d}px)`,
  ];
  return patterns[n % 12];
}

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

/** The 24 original pattern avatars from design/SPIL Avatar.dc.html, ported exactly. */
export function Avatar({ n, size = 48, selected, label, decorative, className }: AvatarProps) {
  const i = (((Math.trunc(n) || 0) % AVATAR_COUNT) + AVATAR_COUNT) % AVATAR_COUNT;
  const [A, B] = PALETTES[(i + (i >= 12 ? 2 : 0)) % 4]!;
  const face = FACES[(i + (i >= 12 ? 5 : 0)) % 12];
  const s = size;
  const P = Math.round(s * 0.5);
  const e = Math.max(2, Math.round(P * 0.13));
  const lw = Math.max(1.5, P * 0.09);

  const eye: CSSProperties = {
    width: e,
    height: e,
    borderRadius: 999,
    background: "var(--avatar-ink)",
    display: "block",
  };
  const mouth: CSSProperties =
    face === 2
      ? {
          display: "block",
          width: e * 1.6,
          height: e * 1.6,
          border: `${Math.max(1.2, e * 0.45)}px solid var(--avatar-ink)`,
          borderRadius: 999,
          boxSizing: "border-box",
        }
      : {
          display: "block",
          width: P * 0.36,
          height: P * 0.16,
          borderBottom: `${lw}px solid var(--avatar-ink)`,
          borderRadius: "0 0 999px 999px",
          boxSizing: "border-box",
        };

  return (
    <span
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : (label ?? `Avatar ${i + 1}`)}
      aria-hidden={decorative || undefined}
      className={className}
      style={{
        width: s,
        height: s,
        borderRadius: 999,
        position: "relative",
        overflow: "hidden",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: selected
          ? "0 0 0 3px var(--bg), 0 0 0 6px var(--accent)"
          : "inset 0 0 0 1px var(--avatar-edge)",
      }}
    >
      <span style={{ position: "absolute", inset: 0, background: pattern(i, s, A, B) }} />
      {face !== 0 && (
        <span
          style={{
            position: "relative",
            width: P,
            height: P,
            borderRadius: 999,
            background: "var(--avatar-plate)",
            boxShadow: `0 0 0 ${Math.max(1, s * 0.03)}px var(--avatar-ink)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: P * 0.07,
          }}
        >
          <span style={{ display: "flex", gap: Math.max(2, P * 0.2), alignItems: "center" }}>
            <span style={eye} />
            <span
              style={
                face === 3
                  ? { ...eye, width: e * 1.7, height: Math.max(1.5, e * 0.5), marginTop: e * 0.3 }
                  : eye
              }
            />
          </span>
          <span style={mouth} />
        </span>
      )}
    </span>
  );
}
