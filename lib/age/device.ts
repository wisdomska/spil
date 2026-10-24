"use client";

import { useCallback, useSyncExternalStore } from "react";
import { toBand, type AgeBand, type AgeResult } from "@/lib/game";

/**
 * The player's age band on this device (SPIL-02). Only the band is stored, never the number:
 * localStorage "spil.age" = { band, setAt }. Bands under 18 (and under 13) also write
 * "spil.ageLock" = { band, until }, and while it lasts the band cannot be changed. If storage is
 * blocked the band lives in memory for this visit, so the player is asked again next time.
 */
const AGE_KEY = "spil.age";
const LOCK_KEY = "spil.ageLock";
const HOUR_MS = 60 * 60 * 1000;

type Stored = { band: AgeResult; setAt: number };
type Lock = { band: AgeResult; until: number };
export type DeviceAge = { band: AgeResult | null; lockedUntil: number };

let cache: DeviceAge | undefined;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage blocked: the in-memory cache still holds it for this visit
  }
}

const VALID = new Set<AgeResult>(["under_13", "13_15", "16_17", "18_plus"]);

function load(now: number): DeviceAge {
  const lock = readJson<Lock>(LOCK_KEY);
  const locked = lock && VALID.has(lock.band) && lock.until > now ? lock : null;
  // A live lock wins over anything else stored: the band it locked is the band.
  if (locked) return { band: locked.band, lockedUntil: locked.until };
  const stored = readJson<Stored>(AGE_KEY);
  const band = stored && VALID.has(stored.band) ? stored.band : null;
  // Under 13 only lasts as long as its lock; afterwards the player is asked again.
  return { band: band === "under_13" ? null : band, lockedUntil: 0 };
}

function snapshot(): DeviceAge {
  cache ??= load(Date.now());
  return cache;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * The stored band: undefined while it cannot be known yet (server render), null when the
 * player has not given an age on this device.
 */
export function useDeviceAge() {
  const age = useSyncExternalStore(subscribe, snapshot, () => undefined);

  /** Saves the band for an age typed on the age screen. `lockHours` comes from admin settings. */
  const setAge = useCallback((years: number, lockHours: number): AgeResult => {
    const now = Date.now();
    const band = toBand(years);
    writeJson(AGE_KEY, { band, setAt: now } satisfies Stored);
    const lockedUntil = band === "18_plus" ? 0 : now + lockHours * HOUR_MS;
    if (lockedUntil) writeJson(LOCK_KEY, { band, until: lockedUntil } satisfies Lock);
    cache = { band, lockedUntil };
    notify();
    return band;
  }, []);

  /** "Not you?": forgets the band so the age screen shows again. Refused while locked. */
  const clearAge = useCallback(() => {
    const current = snapshot();
    if (current.lockedUntil > Date.now()) return;
    writeJson(AGE_KEY, null);
    cache = { band: null, lockedUntil: 0 };
    notify();
  }, []);

  return {
    /** undefined until known on the client; null when not given yet. */
    band: age?.band,
    // Expired locks are dropped when storage is read, so any lock here is live for this visit.
    locked: Boolean(age?.lockedUntil),
    setAge,
    clearAge,
  };
}

/** A band that may play (13 and up), or null. */
export function playableBand(band: AgeResult | null | undefined): AgeBand | null {
  return band && band !== "under_13" ? band : null;
}
