"use client";

import QRCode from "qrcode";
import { useMemo } from "react";

/**
 * SPIL-28: the invite link as a QR code, drawn here as SVG (no outside QR service). Modules use
 * the current text colour, so it sits on a light card (`bg-inverse text-on-inverse`).
 */
export function QrCode({ value, size, label }: { value: string; size: number; label: string }) {
  const { path, count } = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
    const n = qr.modules.size;
    let d = "";
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) if (qr.modules.get(x, y)) d += `M${x} ${y}h1v1h-1z`;
    return { path: d, count: n };
  }, [value]);
  return (
    <svg
      role="img"
      aria-label={label}
      data-value={value}
      viewBox={`-2 -2 ${count + 4} ${count + 4}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className="block"
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
}
