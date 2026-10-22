import { cn } from "@/lib/cn";

/** "SPIL" with the tilted, dripping I. Port of the design's inline wordmark. */
export function Wordmark({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label="SPIL"
      className={cn(
        "inline-flex items-baseline font-display leading-none font-extrabold tracking-[-0.03em]",
        className,
      )}
      style={{ fontSize: size }}
    >
      <span
        aria-hidden
        className="inline-block"
        style={{ transform: "rotate(-8deg) translateY(.03em)" }}
      >
        S
      </span>
      <span
        aria-hidden
        className="inline-block"
        style={{ transform: "rotate(5deg) translateY(-.05em)", marginLeft: "-.01em" }}
      >
        P
      </span>
      <span
        aria-hidden
        className="relative inline-block text-accent"
        style={{
          fontStretch: "75%",
          transform: "rotate(14deg)",
          transformOrigin: "50% 90%",
          margin: "0 .14em 0 -.03em",
        }}
      >
        I
        <span
          className="absolute bg-accent"
          style={{
            top: "-.17em",
            right: "-.2em",
            width: ".13em",
            height: ".13em",
            borderRadius: "0 50% 50% 50%",
          }}
        />
        <span
          className="absolute rounded-full bg-accent"
          style={{ top: "-.3em", right: ".02em", width: ".07em", height: ".07em" }}
        />
      </span>
      <span
        aria-hidden
        className="inline-block"
        style={{ transform: "rotate(-4deg) translateY(.02em)" }}
      >
        L
      </span>
    </span>
  );
}
