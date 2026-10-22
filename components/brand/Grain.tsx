const NOISE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

/** Film grain on a fixed layer at the app root. Never on a scrolling element (HANDOFF rule 7). */
export function Grain() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0"
      style={{
        zIndex: "var(--z-grain)",
        backgroundImage: NOISE,
        opacity: "var(--grain-opacity)",
        mixBlendMode: "var(--grain-blend)" as React.CSSProperties["mixBlendMode"],
      }}
    />
  );
}
