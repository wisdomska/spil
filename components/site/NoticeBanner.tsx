"use client";

import { MegaphoneSimpleIcon, XIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

const KEY = "spil.notice.hidden";

/**
 * The notice admins switch on in Settings (owner request 2026-11-12): one line above every player
 * page, for maintenance or an event. Hiding it lasts until the text changes or the tab closes.
 * Never shown in the admin console, which has its own preview.
 */
export function NoticeBanner() {
  const t = useTranslations("common");
  const [text, setText] = useState("");
  // Read once on the client; nothing renders until the notice text arrives, so the server and
  // client markup match either way.
  const [hidden, setHidden] = useState<string | null>(() => {
    try {
      return typeof window === "undefined" ? null : sessionStorage.getItem(KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    // Read here, not with usePathname, so every page can still be prerendered.
    if (location.pathname.startsWith("/admin")) return;
    let live = true;
    fetch("/api/v1/notice")
      .then((r) => (r.ok ? r.json() : { text: "" }))
      .then((d: { text?: string }) => live && setText(d.text ?? ""))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!text || hidden === text) return null;
  return (
    <div
      role="status"
      className="relative z-[var(--z-sticky)] flex items-center gap-3 border-b border-line bg-surface-raised py-2 pr-2 pl-4 text-[14px] leading-[1.4] font-medium text-text"
    >
      <MegaphoneSimpleIcon aria-hidden size={18} className="shrink-0 text-accent-ink" />
      <span className="mx-auto max-w-[1100px] flex-1">{text}</span>
      <button
        type="button"
        aria-label={t("hideNotice")}
        onClick={() => {
          setHidden(text);
          try {
            sessionStorage.setItem(KEY, text);
          } catch {}
        }}
        className="grid size-10 shrink-0 place-items-center rounded-pill border-0 bg-transparent text-text-muted hover:bg-surface hover:text-text"
      >
        <XIcon aria-hidden size={16} />
      </button>
    </div>
  );
}
