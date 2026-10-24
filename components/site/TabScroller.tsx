"use client";

import { useEffect, useRef } from "react";

/** The help tab bar: brings the current tab into view when the bar is narrower than its tabs. */
export function TabScroller({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = ref.current;
    const current = nav?.querySelector<HTMLElement>("[aria-current='page']");
    if (!nav || !current || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollLeft = current.offsetLeft - (nav.clientWidth - current.offsetWidth) / 2;
  }, []);
  return (
    <nav ref={ref} aria-label={label} className={className}>
      {children}
    </nav>
  );
}
