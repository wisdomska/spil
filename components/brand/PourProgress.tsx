/** Question progress: clip-path pour, 300 ms ease-out; the drip rides a translateX layer (HANDOFF). */
export function PourProgress({
  value,
  total,
  label,
}: {
  value: number;
  total: number;
  label: string;
}) {
  const pct = Math.max(4, (value / Math.max(1, total)) * 100);
  const gap = 100 - pct;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={value}
      className="relative h-3 flex-1 rounded-pill bg-surface-raised"
    >
      <div
        className="absolute inset-0 rounded-pill bg-accent"
        style={{
          clipPath: `inset(0 ${gap}% 0 0 round 999px)`,
          transition: "clip-path 300ms var(--ease-out)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ transform: `translateX(-${gap}%)`, transition: "transform 300ms var(--ease-out)" }}
      >
        <span
          className="absolute top-[7px] right-px h-3 w-[9px] bg-accent"
          style={{ borderRadius: "50% 50% 50% 50% / 40% 40% 60% 60%" }}
        />
      </div>
    </div>
  );
}
