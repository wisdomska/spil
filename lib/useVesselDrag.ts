"use client";

import { useRef, useState } from "react";
import { levelFromPointer } from "./vessel";

/**
 * Drag anywhere on a vessel to set its level; a tap jumps straight there (SPIL-10). The element
 * needs `touch-action: none` so the page does not scroll while dragging.
 */
export function useVesselDrag(onLevel: (level: number) => void, enabled = true) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const fromY = (clientY: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (r) onLevel(levelFromPointer(clientY, r.top, r.height));
  };

  const handlers = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
      fromY(e.clientY);
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      if (dragging) fromY(e.clientY);
    },
    onPointerUp: () => setDragging(false),
    onPointerCancel: () => setDragging(false),
  };

  return { ref, dragging, handlers };
}
