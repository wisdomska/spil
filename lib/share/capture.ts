"use client";

/**
 * Renders a ShareCard element to PNG at 1x after fonts are ready, then shares it with the native
 * sheet when the browser can share files, else downloads it.
 */
export async function cardToBlob(node: HTMLElement): Promise<Blob> {
  const { domToBlob } = await import("modern-screenshot");
  await document.fonts.ready;
  const blob = await domToBlob(node, { scale: 1, type: "image/png" });
  if (!blob) throw new Error("capture failed");
  return blob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Returns "shared", "saved", or "cancelled". */
export async function shareOrSave(
  blob: Blob,
  filename: string,
  text: string,
  url?: string,
): Promise<"shared" | "saved" | "cancelled"> {
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, url });
      return "shared";
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return "cancelled";
    }
  }
  downloadBlob(blob, filename);
  return "saved";
}

/** The last finished game, kept on this device so the landing page can offer the card again. */
export type LastGame = {
  room: string;
  at: number;
  name: string;
  avatar: number;
  score: number;
  award: string;
  board: Array<{ rank: number; name: string; avatar: number; score: number }>;
};

export const LAST_KEY = "spil-last";

export function readLastGame(): LastGame | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    return raw ? (JSON.parse(raw) as LastGame) : null;
  } catch {
    return null;
  }
}

export function saveLastGame(game: LastGame) {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(game));
  } catch {
    // storage blocked: the landing page falls back to the sample card
  }
}

/** Whole days since a timestamp, for "today / yesterday / n days ago". */
export function daysSince(at: number) {
  return Math.floor((Date.now() - at) / 86_400_000);
}
