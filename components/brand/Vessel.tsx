"use client";

import { motion, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { cn } from "@/lib/cn";

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

const WAVE_BG =
  "radial-gradient(circle at 50% 100%, var(--accent) 62%, transparent 64%) 0 0/26px 10px repeat-x";

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
          <Wave visible={staticOff > 0 && staticOff < 100} animate={showWave} />
          <div className="absolute inset-0 overflow-hidden bg-accent">
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
  const waveOpacity = useTransform(level, (v) => (v > 0 && v < 100 ? 1 : 0));
  return (
    <motion.div style={{ position: "absolute", inset: 0, y, willChange: "transform" }}>
      <motion.div
        style={{
          position: "absolute",
          left: -26,
          top: -10,
          width: "calc(100% + 26px)",
          height: 10,
          opacity: waveOpacity,
        }}
      >
        <WaveStrip animate={showWave} />
      </motion.div>
      <div className="absolute inset-0 overflow-hidden bg-accent">
        {num != null && (
          <motion.div style={{ ...numStyle, color: "var(--on-accent)", y: counterY }}>
            {isMotionValue(num) ? <motion.span>{num}</motion.span> : num}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function Wave({ visible, animate }: { visible: boolean; animate: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        left: -26,
        top: -10,
        width: "calc(100% + 26px)",
        height: 10,
        opacity: visible ? 1 : 0,
        transition: "opacity 200ms ease",
      }}
    >
      <WaveStrip animate={animate} />
    </div>
  );
}

/** 26 px wave strip on a translateX loop, 1.6 s linear. Off in reduced motion. */
function WaveStrip({ animate }: { animate: boolean }) {
  return (
    <div
      className={animate ? "animate-[spil-wave_1.6s_linear_infinite]" : undefined}
      style={{ position: "absolute", inset: 0, background: WAVE_BG }}
    />
  );
}

function isMotionValue(v: unknown): v is MotionValue<string> {
  return typeof v === "object" && v !== null && "get" in v && "on" in v;
}

function Num({ value, style }: { value: VesselProps["num"]; style: React.CSSProperties }) {
  if (isMotionValue(value)) return <motion.div style={style}>{value}</motion.div>;
  return <div style={style}>{value}</div>;
}
