import { forwardRef } from "react";
import { Avatar } from "@/components/brand/Avatar";
import { AWARD_LOOK, type AwardKey } from "@/components/brand/Stickers";
import { labelFor } from "@/lib/game";
import { Wordmark } from "@/components/brand/Wordmark";

export type CardFormat = "story" | "square" | "og";
/** `points` are guessing points (the ranking); older saved games only have `score`. */
export type BoardRow = {
  rank: number;
  name: string;
  avatar: number;
  score: number;
  points?: number;
};

export type ShareCardProps = {
  format: CardFormat;
  /** Scale for on-screen previews; capture always renders at 1. */
  scale?: number;
  theme?: "dark" | "light";
  name?: string;
  hideName?: boolean;
  avatar?: number;
  score?: number;
  award?: AwardKey;
  room?: string;
  /** The pack the room played, shown under the room code. */
  pack?: string;
  board?: BoardRow[];
  /** Square card footer sticker, e.g. Mind Reader: Zainab. */
  boardAward?: { award: AwardKey; name: string };
  copy: {
    spillScore: string;
    owner: (name: string) => string;
    mine: string;
    tagline: string;
    room: (code: string) => string;
    topped: (name: string) => string;
    headline: string;
    headlineEmphasis: string;
    domain: string;
    awardName?: (award: AwardKey) => string;
  };
};

const SIZE: Record<CardFormat, [number, number]> = {
  story: [1080, 1920],
  square: [1080, 1080],
  og: [1200, 630],
};

const WAVE = (w: number, h: number) =>
  `radial-gradient(circle at 50% 100%, var(--accent) 62%, transparent 64%) 0 0/${w}px ${h}px repeat-x`;

/** Number drawn twice so its colour flips at the fill line (HANDOFF rule 6). */
function Fill({
  score,
  height,
  fontSize,
  waveW,
  waveH,
}: {
  score: number;
  height: number;
  fontSize: number;
  waveW: number;
  waveH: number;
}) {
  const num: React.CSSProperties = {
    position: "absolute",
    inset: "auto 0 0 0",
    height,
    display: "grid",
    placeItems: "center",
    font: `600 ${fontSize}px/1 var(--font-mono)`,
    letterSpacing: "-.07em",
  };
  return (
    <>
      <div style={{ ...num, inset: 0, height: "auto", color: "var(--text)" }}>{score}</div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: `${score}%`,
          background: "var(--accent)",
          overflow: "hidden",
        }}
      >
        <div style={{ ...num, color: "var(--on-accent)" }}>{score}</div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: `${score}%`,
          height: waveH,
          background: WAVE(waveW, waveH),
        }}
      />
    </>
  );
}

/** One component, three formats: 1080x1920 story, 1080x1080 group, 1200x630 link preview. */
export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(function ShareCard(
  {
    format,
    scale = 1,
    theme = "dark",
    name = "",
    hideName,
    avatar = 0,
    score = 0,
    award = "open_book",
    room = "",
    pack,
    board = [],
    boardAward,
    copy,
  },
  ref,
) {
  const [W, H] = SIZE[format];
  const label = labelFor(score);
  const look = AWARD_LOOK[award];
  const top = board[0];

  return (
    <div
      style={{
        width: W * scale,
        height: H * scale,
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
        borderRadius: Math.max(6, 28 * scale),
      }}
    >
      <div
        ref={ref}
        data-theme={theme}
        className="bg-bg text-text"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: W,
          height: H,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
          fontFamily: "var(--font-sans)",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(var(--halftone) 1.7px, transparent 1.9px)",
            backgroundSize: "10px 10px",
            pointerEvents: "none",
          }}
        />

        {format === "story" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: 96,
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Wordmark size={104} />
              <span style={{ display: "grid", justifyItems: "end", gap: 14 }}>
                <span
                  style={{
                    font: "500 32px/1 var(--font-mono)",
                    color: "var(--text-muted)",
                    letterSpacing: ".06em",
                  }}
                >
                  {copy.room(room)}
                </span>
                {pack && (
                  <span style={{ font: "700 36px/1 var(--font-sans)", whiteSpace: "nowrap" }}>
                    {pack}
                  </span>
                )}
              </span>
            </div>
            <div style={{ marginTop: 120, display: "flex", alignItems: "center", gap: 32 }}>
              {!hideName && <Avatar n={avatar} size={128} decorative />}
              <div style={{ display: "grid", gap: 10 }}>
                <span style={{ font: "500 44px/1 var(--font-sans)", color: "var(--text-muted)" }}>
                  {hideName ? copy.mine : copy.owner(name)}
                </span>
                <span
                  style={{ font: "800 100px/.92 var(--font-display)", letterSpacing: "-.035em" }}
                >
                  {copy.spillScore}
                </span>
              </div>
            </div>
            <div
              style={{
                position: "relative",
                marginTop: 72,
                height: 880,
                borderRadius: 56,
                background: "var(--surface-raised)",
                overflow: "hidden",
              }}
            >
              <Fill score={score} height={880} fontSize={420} waveW={80} waveH={30} />
            </div>
            <div style={{ position: "relative", height: 0 }}>
              <span
                style={{
                  position: "absolute",
                  left: 40,
                  top: -110,
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "22px 40px",
                  background: "var(--inverse)",
                  color: "var(--on-inverse)",
                  border: "10px solid var(--sticker-edge)",
                  borderRadius: 999,
                  boxShadow: "0 0 0 3px var(--sticker-ring), 0 18px 30px -14px var(--shadow)",
                  font: "800 64px/1 var(--font-display)",
                  letterSpacing: "-.02em",
                  transform: "rotate(-4deg)",
                  whiteSpace: "nowrap",
                }}
              >
                {label.name}
              </span>
              <span
                style={{
                  position: "absolute",
                  right: 24,
                  top: -930,
                  width: 250,
                  height: 250,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  background: "var(--accent)",
                  color: "var(--on-accent)",
                  border: "10px solid var(--sticker-edge)",
                  borderRadius: "50%",
                  boxShadow: "0 0 0 3px var(--sticker-ring), 0 18px 30px -14px var(--shadow)",
                  font: "800 40px/1 var(--font-display)",
                  textAlign: "center",
                  transform: "rotate(6deg)",
                }}
              >
                <look.Icon size={72} />
                <span style={{ maxWidth: 190 }}>{copy.awardName?.(award) ?? look.name}</span>
              </span>
            </div>
            <div
              style={{
                marginTop: "auto",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                gap: 40,
              }}
            >
              <span
                style={{
                  font: "800 60px/1 var(--font-display)",
                  letterSpacing: "-.03em",
                  maxWidth: 440,
                }}
              >
                {copy.tagline}
              </span>
              <span
                style={{
                  font: "600 30px/1 var(--font-mono)",
                  color: "var(--accent-ink)",
                  whiteSpace: "nowrap",
                }}
              >
                {copy.domain}
              </span>
            </div>
          </div>
        )}

        {format === "square" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: 72,
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              gap: 36,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Wordmark size={76} />
              <span style={{ display: "grid", justifyItems: "end", gap: 10 }}>
                <span
                  style={{
                    font: "500 28px/1 var(--font-mono)",
                    color: "var(--text-muted)",
                    letterSpacing: ".06em",
                  }}
                >
                  {copy.room(room)}
                </span>
                {pack && (
                  <span style={{ font: "700 30px/1 var(--font-sans)", whiteSpace: "nowrap" }}>
                    {pack}
                  </span>
                )}
              </span>
            </div>
            <span style={{ font: "800 72px/.95 var(--font-display)", letterSpacing: "-.035em" }}>
              {copy.topped(top?.name ?? "")}
            </span>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "400px 1fr",
                gap: 56,
                flex: 1,
                minHeight: 0,
              }}
            >
              <div
                style={{
                  position: "relative",
                  borderRadius: 44,
                  background: "var(--surface-raised)",
                  overflow: "hidden",
                }}
              >
                <Fill score={top?.score ?? 0} height={648} fontSize={220} waveW={64} waveH={24} />
                <span
                  style={{
                    position: "absolute",
                    left: 24,
                    bottom: 32,
                    display: "inline-flex",
                    padding: "14px 26px",
                    background: "var(--inverse)",
                    color: "var(--on-inverse)",
                    border: "7px solid var(--sticker-edge)",
                    borderRadius: 14,
                    boxShadow: "0 0 0 2px var(--sticker-ring)",
                    font: "800 38px/1 var(--font-display)",
                    fontStretch: "80%",
                    transform: "rotate(-4deg)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {labelFor(top?.score ?? 0).name}
                </span>
              </div>
              {/* Rows stack from the top; a short room should not spread them down the card. */}
              <div
                style={{ display: "flex", flexDirection: "column", justifyContent: "flex-start" }}
              >
                {board.slice(0, 6).map((p) => (
                  <div
                    key={p.rank + p.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 22,
                      padding: "10px 0",
                      borderBottom: "2px solid var(--line)",
                    }}
                  >
                    <span
                      style={{
                        font: "500 30px/1 var(--font-mono)",
                        color: "var(--text-muted)",
                        width: 36,
                      }}
                    >
                      {p.rank}
                    </span>
                    <Avatar n={p.avatar} size={68} decorative />
                    <span
                      style={{
                        flex: 1,
                        font: "700 42px/1 var(--font-display)",
                        letterSpacing: "-.02em",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {p.name}
                    </span>
                    <span
                      style={{
                        font: "600 44px/1 var(--font-mono)",
                        fontVariantNumeric: "tabular-nums",
                        display: "flex",
                        alignItems: "baseline",
                        gap: 8,
                      }}
                    >
                      {p.points ?? p.score}
                      {p.points != null && (
                        <span
                          style={{
                            font: "500 22px/1 var(--font-mono)",
                            color: "var(--text-muted)",
                          }}
                        >
                          pts
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {boardAward ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "14px 28px",
                    background: "var(--accent)",
                    color: "var(--on-accent)",
                    border: "7px solid var(--sticker-edge)",
                    borderRadius: 999,
                    boxShadow: "0 0 0 2px var(--sticker-ring)",
                    font: "800 36px/1 var(--font-display)",
                    transform: "rotate(3deg)",
                  }}
                >
                  {(() => {
                    const A = AWARD_LOOK[boardAward.award];
                    return (
                      <>
                        <A.Icon size={40} />
                        {copy.awardName?.(boardAward.award) ?? A.name}: {boardAward.name}
                      </>
                    );
                  })()}
                </span>
              ) : (
                <span />
              )}
              <span style={{ font: "600 34px/1 var(--font-mono)", color: "var(--accent-ink)" }}>
                {copy.domain}
              </span>
            </div>
          </div>
        )}

        {format === "og" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: 64,
              boxSizing: "border-box",
              display: "grid",
              gridTemplateColumns: "1fr 340px",
              gap: 64,
            }}
          >
            <div
              style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}
            >
              <Wordmark size={96} />
              <span
                style={{
                  font: "800 70px/.95 var(--font-display)",
                  letterSpacing: "-.035em",
                  textWrap: "balance",
                }}
              >
                {copy.headline}{" "}
                <span style={{ fontStretch: "75%", color: "var(--accent-ink)" }}>
                  {copy.headlineEmphasis}
                </span>
              </span>
              <span style={{ font: "600 30px/1 var(--font-mono)", color: "var(--text-muted)" }}>
                {copy.domain}
              </span>
            </div>
            <div
              style={{
                position: "relative",
                borderRadius: 36,
                background: "var(--surface-raised)",
                overflow: "hidden",
              }}
            >
              <Fill score={score} height={502} fontSize={180} waveW={54} waveH={20} />
              <span
                style={{
                  position: "absolute",
                  left: 18,
                  bottom: 28,
                  display: "inline-flex",
                  padding: "12px 22px",
                  background: "var(--inverse)",
                  color: "var(--on-inverse)",
                  border: "6px solid var(--sticker-edge)",
                  borderRadius: 999,
                  boxShadow: "0 0 0 2px var(--sticker-ring)",
                  font: "800 30px/1 var(--font-display)",
                  transform: "rotate(-4deg)",
                  whiteSpace: "nowrap",
                }}
              >
                {label.name}
              </span>
              <span
                style={{
                  position: "absolute",
                  right: 16,
                  top: 18,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 18px",
                  background: "var(--accent)",
                  color: "var(--on-accent)",
                  border: "6px solid var(--sticker-edge)",
                  borderRadius: 12,
                  boxShadow: "0 0 0 2px var(--sticker-ring)",
                  font: "800 24px/1 var(--font-display)",
                  transform: "rotate(4deg)",
                }}
              >
                <look.Icon size={28} />
                {copy.awardName?.(award) ?? look.name}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
