/**
 * iPhone and iPad launch screens for the installed app (owner request 2026-11-23, like Clink):
 * the dark background and the SPIL mark instead of a white flash. Portrait only, matching the
 * manifest. Made by scripts/build-pwa-assets.mjs; keep the two lists in step.
 */
export const SPLASH_SCREENS = [
  { w: 375, h: 667, dpr: 2 }, // iPhone SE, 8
  { w: 414, h: 896, dpr: 2 }, // iPhone XR, 11
  { w: 375, h: 812, dpr: 3 }, // iPhone X, XS, 11 Pro, 12 and 13 mini
  { w: 390, h: 844, dpr: 3 }, // iPhone 12, 13, 14
  { w: 393, h: 852, dpr: 3 }, // iPhone 14 Pro, 15, 15 Pro, 16
  { w: 402, h: 874, dpr: 3 }, // iPhone 16 Pro, 17
  { w: 414, h: 896, dpr: 3 }, // iPhone XS Max, 11 Pro Max
  { w: 428, h: 926, dpr: 3 }, // iPhone 12 and 13 Pro Max, 14 Plus
  { w: 430, h: 932, dpr: 3 }, // iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  { w: 440, h: 956, dpr: 3 }, // iPhone 16 Pro Max, 17 Pro Max
  { w: 768, h: 1024, dpr: 2 }, // iPad mini, 9.7"
  { w: 820, h: 1180, dpr: 2 }, // iPad Air
  { w: 1024, h: 1366, dpr: 2 }, // iPad Pro 12.9"
] as const;

export const splashFile = (s: { w: number; h: number; dpr: number }) =>
  `/splash/splash-${s.w * s.dpr}x${s.h * s.dpr}.png`;

export const splashMedia = (s: { w: number; h: number; dpr: number }) =>
  `(device-width: ${s.w}px) and (device-height: ${s.h}px) and (-webkit-device-pixel-ratio: ${s.dpr}) and (orientation: portrait)`;
