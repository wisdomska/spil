/**
 * The last nickname and face used on this device (SPIL-17), so the next room needs no typing.
 * localStorage "spil.profile" = { nickname, avatar }. Written only after a successful join or
 * create; never sent anywhere. Storage can be blocked, so every access is guarded.
 */
const KEY = "spil.profile";

export type DeviceProfile = { nickname: string; avatar: number };

/** A stored value, if it is still a usable nickname and face. */
export function parseProfile(raw: string | null, avatarCount: number): DeviceProfile | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<DeviceProfile>;
    const nickname = typeof v.nickname === "string" ? v.nickname.trim().slice(0, 16) : "";
    const avatar = v.avatar;
    if (nickname.length < 2) return null;
    if (typeof avatar !== "number" || !Number.isInteger(avatar)) return null;
    if (avatar < 0 || avatar >= avatarCount) return null;
    return { nickname, avatar };
  } catch {
    return null;
  }
}

export function readProfile(avatarCount: number): DeviceProfile | null {
  try {
    return parseProfile(localStorage.getItem(KEY), avatarCount);
  } catch {
    return null;
  }
}

export function saveProfile(profile: DeviceProfile) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...profile, nickname: profile.nickname.trim() }));
    notify();
  } catch {
    // storage blocked: the player types it next time
  }
}

export function clearProfile() {
  try {
    localStorage.removeItem(KEY);
    notify();
  } catch {}
}

/** Fired on this tab when the saved name and face change (other tabs get "storage"). */
const CHANGED = "spil:profile";

function notify() {
  try {
    window.dispatchEvent(new Event(CHANGED));
  } catch {}
}

/** Subscribe to the saved name and face, for useSyncExternalStore. */
export function subscribeProfile(onChange: () => void) {
  const onStorage = (e: StorageEvent) => e.key === KEY && onChange();
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The raw stored value, so useSyncExternalStore gets a stable snapshot between changes. */
export function profileSnapshot(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
