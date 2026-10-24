"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Reveal sounds (SPIL-11): pour, stamp and drumroll, synthesized with Web Audio, so there are
 * no files to download. On by default and remembered per device ("spil.sound"). Browsers only
 * let audio start after the person has interacted with the page; anything earlier is silent.
 */
export type SoundKind = "pour" | "stamp" | "drumroll";

const KEY = "spil.sound";
const listeners = new Set<() => void>();
let ctx: AudioContext | null = null;

function readOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

let on: boolean | undefined;
const snapshot = () => (on ??= readOn());

export function useSoundSetting() {
  const value = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    snapshot,
    () => true,
  );
  const toggle = useCallback(() => {
    on = !snapshot();
    try {
      localStorage.setItem(KEY, on ? "on" : "off");
    } catch {
      // the setting lasts for this visit
    }
    listeners.forEach((l) => l());
  }, []);
  return { on: value, toggle };
}

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
}

function noise(c: AudioContext, seconds: number) {
  const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  return src;
}

export function playSound(kind: SoundKind) {
  if (!snapshot()) return;
  const c = audio();
  if (!c || c.state !== "running") return;
  const t = c.currentTime;
  const out = c.createGain();
  out.connect(c.destination);

  if (kind === "pour") {
    // A rising filtered rush, the length of the fill.
    const src = noise(c, 1.6);
    const band = c.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 1.2;
    band.frequency.setValueAtTime(350, t);
    band.frequency.exponentialRampToValueAtTime(1800, t + 1.5);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.18, t + 0.15);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    src.connect(band).connect(out);
    src.start(t);
    src.stop(t + 1.6);
  } else if (kind === "stamp") {
    // A low thump with a short click on top.
    const osc = c.createOscillator();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.18);
    out.gain.setValueAtTime(0.5, t);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    osc.connect(out);
    osc.start(t);
    osc.stop(t + 0.26);
    const click = noise(c, 0.04);
    const clickGain = c.createGain();
    clickGain.gain.value = 0.12;
    click.connect(clickGain).connect(c.destination);
    click.start(t);
  } else {
    // Drumroll: fast noise hits that build for the top spiller beat.
    const src = noise(c, 1.5);
    const low = c.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 900;
    out.gain.setValueAtTime(0.0001, t);
    for (let i = 0; i < 27; i++) {
      const at = t + i * 0.052;
      const peak = 0.05 + (i / 27) * 0.25;
      out.gain.setValueAtTime(peak, at);
      out.gain.exponentialRampToValueAtTime(0.0001, at + 0.045);
    }
    src.connect(low).connect(out);
    src.start(t);
    src.stop(t + 1.5);
  }
}

/** Starts the audio engine early (call on a tap) so the first reveal sound is not lost. */
export function primeSound() {
  audio();
}
