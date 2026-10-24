/** Browser family only (SPIL-05): the full user agent is never stored. Pure. */
export type BrowserFamily = "chrome" | "safari" | "firefox" | "edge" | "other";

export function browserFamily(userAgent: string | null): BrowserFamily {
  const ua = userAgent ?? "";
  if (/Edg\//.test(ua)) return "edge";
  if (/Firefox\/|FxiOS\//.test(ua)) return "firefox";
  if (/Chrome\/|CriOS\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "other";
}
