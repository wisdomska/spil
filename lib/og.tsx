import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Open Graph images render outside the CSS cascade (Satori), so the dark theme tokens are
// written out here. Values match app/styles/tokens.css.
const T = {
  bg: "#101114",
  surfaceRaised: "#1F2027",
  text: "#F3F1EC",
  muted: "#A3A3AD",
  accent: "#FF5B3A",
  onAccent: "#101114",
  inverse: "#F3F1EC",
  onInverse: "#101114",
  edge: "#F3F1EC",
};

let fonts: Promise<
  Array<{ name: string; data: Buffer; weight: 500 | 600 | 800; style: "normal" }>
> | null = null;
function loadFonts() {
  fonts ??= Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Bricolage-800.woff")),
    readFile(join(process.cwd(), "assets/fonts/GeistMono-600.ttf")),
    readFile(join(process.cwd(), "assets/fonts/Geist-500.ttf")),
  ]).then(([display, mono, sans]) => [
    { name: "Bricolage", data: display, weight: 800, style: "normal" },
    { name: "GeistMono", data: mono, weight: 600, style: "normal" },
    { name: "Geist", data: sans, weight: 500, style: "normal" },
  ]);
  return fonts;
}

function Wordmark({ size }: { size: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        fontFamily: "Bricolage",
        fontSize: size,
        letterSpacing: "-0.03em",
        color: T.text,
        lineHeight: 1,
      }}
    >
      <span style={{ transform: "rotate(-8deg)" }}>S</span>
      <span style={{ transform: "rotate(5deg)" }}>P</span>
      <span style={{ transform: "rotate(14deg)", color: T.accent, margin: "0 0.12em 0 0.02em" }}>
        I
      </span>
      <span style={{ transform: "rotate(-4deg)" }}>L</span>
    </div>
  );
}

/** 1200x630 card: headline on the left, liquid score vessel with label and award on the right. */
export async function ogCard({
  headline,
  emphasis,
  footer,
  score = 72,
  label = "Main Character",
  award = "Open Book",
}: {
  headline: string;
  emphasis?: string;
  footer: string;
  score?: number;
  label?: string;
  award?: string;
}) {
  const fill = Math.max(0, Math.min(100, score));
  return new ImageResponse(
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        background: T.bg,
        padding: 64,
        gap: 64,
        fontFamily: "Geist",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <Wordmark size={96} />
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            columnGap: 18,
            fontFamily: "Bricolage",
            fontSize: 70,
            lineHeight: 0.95,
            letterSpacing: "-0.035em",
            color: T.text,
          }}
        >
          <span>{headline}</span>
          {emphasis && <span style={{ color: T.accent }}>{emphasis}</span>}
        </div>
        <span style={{ fontFamily: "GeistMono", fontSize: 30, color: T.muted }}>{footer}</span>
      </div>
      <div
        style={{
          width: 340,
          position: "relative",
          display: "flex",
          borderRadius: 36,
          background: T.surfaceRaised,
          overflow: "hidden",
        }}
      >
        {/* Number drawn twice; the copy inside the fill is clipped, so the colour flips at the waterline. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 502,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "GeistMono",
            fontSize: 180,
            letterSpacing: "-0.07em",
            color: T.text,
          }}
        >
          {String(score)}
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: `${fill}%`,
            background: T.accent,
            overflow: "hidden",
            display: "flex",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 502,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "GeistMono",
              fontSize: 180,
              letterSpacing: "-0.07em",
              color: T.onAccent,
            }}
          >
            {String(score)}
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 18,
            bottom: 28,
            display: "flex",
            padding: "12px 22px",
            background: T.inverse,
            color: T.onInverse,
            border: `6px solid ${T.edge}`,
            borderRadius: 999,
            fontFamily: "Bricolage",
            fontSize: 30,
            transform: "rotate(-4deg)",
          }}
        >
          {label}
        </div>
        <div
          style={{
            position: "absolute",
            right: 16,
            top: 18,
            display: "flex",
            padding: "10px 18px",
            background: T.accent,
            color: T.onAccent,
            border: `6px solid ${T.edge}`,
            borderRadius: 12,
            fontFamily: "Bricolage",
            fontSize: 24,
            transform: "rotate(4deg)",
          }}
        >
          {award}
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: await loadFonts(),
      headers: {
        "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
