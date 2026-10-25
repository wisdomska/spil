"use client";

import { motion, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { cn } from "@/lib/cn";
import { liquidMask } from "@/lib/vessel";

type VesselProps = {
  /** 0 to 100 fill. A number animates with `transition`; a MotionValue is driven frame by frame. */
  level: number | MotionValue<number>;
  /** Number shown twice so its colour flips exactly at the waterline (HANDOFF rule 6). */
  num?: React.ReactNode | MotionValue<string>;
  height: number;
  fontSize?: number;
  radius?: number;
  /** CSS transition for the fill when `level` is a number. Never animate height. */
  transition?: string;
  wave?: boolean;
  className?: string;
};

const WAVE_W = 26;
const CREST = 10;
const WAVE_ANIMATION = "spil-wave-mask 1.6s linear infinite";

/** The liquid vessel: fill layer moves with translateY(100 - level%). One liquid moment per screen. */
export function Vessel({
  level,
  num,
  height,
  fontSize = 64,
  radius = 20,
  transition = "none",
  wave = true,
  className,
}: VesselProps) {
  const reduced = useReducedMotion();
  const isMotion = typeof level !== "number";
  const staticOff = isMotion ? 0 : 100 - Math.max(0, Math.min(100, level));

  const numStyle: React.CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height,
    display: "grid",
    placeItems: "center",
    fontFamily: "var(--font-mono)",
    fontWeight: 600,
    fontSize,
    lineHeight: 1,
    letterSpacing: "-.06em",
    fontVariantNumeric: "tabular-nums",
  };

  const showWave = wave && !reduced;

  return (
    <div
      aria-hidden
      className={cn("relative w-full overflow-hidden bg-surface-raised", className)}
      style={{ height, borderRadius: radius }}
    >
      {num != null && <Num value={num} style={{ ...numStyle, color: "var(--text)" }} />}
      {isMotion ? (
        <MotionFill level={level} num={num} numStyle={numStyle} showWave={showWave} />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `translateY(${staticOff}%)`,
            transition,
            willChange: "transform",
          }}
        >
          {/* SPIL-24: one masked element draws the crest and clips the dark number. */}
          <div
            className="absolute overflow-hidden bg-accent"
            style={{
              inset: `-${CREST}px 0 0 0`,
              mask: liquidMask(WAVE_W, CREST, staticOff > 0 && staticOff < 100),
              animation: showWave ? WAVE_ANIMATION : undefined,
            }}
          >
            {num != null && (
              <Num
                value={num}
                style={{
                  ...numStyle,
                  color: "var(--on-accent)",
                  transform: `translateY(-${staticOff}%)`,
                  transition,
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MotionFill({
  level,
  num,
  numStyle,
  showWave,
}: {
  level: MotionValue<number>;
  num: VesselProps["num"];
  numStyle: React.CSSProperties;
  showWave: boolean;
}) {
  const y = useTransform(level, (v) => `${100 - Math.max(0, Math.min(100, v))}%`);
  const counterY = useTransform(level, (v) => `-${100 - Math.max(0, Math.min(100, v))}%`);
  const mask = useTransform(level, (v) => liquidMask(WAVE_W, CREST, v > 0 && v < 100));
  return (
    <motion.div style={{ position: "absolute", inset: 0, y, willChange: "transform" }}>
      {/* SPIL-24: one masked element draws the crest and clips the dark number. */}
      <motion.div
        className="absolute overflow-hidden bg-accent"
        style={{
          inset: `-${CREST}px 0 0 0`,
          mask,
          animation: showWave ? WAVE_ANIMATION : undefined,
        }}
      >
        {num != null && (
          <motion.div style={{ ...numStyle, color: "var(--on-accent)", y: counterY }}>
            {isMotionValue(num) ? <motion.span>{num}</motion.span> : num}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

function isMotionValue(v: unknown): v is MotionValue<string> {
  return typeof v === "object" && v !== null && "get" in v && "on" in v;
}

function Num({ value, style }: { value: VesselProps["num"]; style: React.CSSProperties }) {
  if (isMotionValue(value)) return <motion.div style={style}>{value}</motion.div>;
  return <div style={style}>{value}</div>;
}
