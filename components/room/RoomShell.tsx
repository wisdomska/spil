"use client";

import { CheckIcon, CopyIcon, SignOutIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Avatar } from "@/components/brand/Avatar";
import { Wordmark } from "@/components/brand/Wordmark";
import { useToast } from "@/components/ui/Toast";
import type { RoomState } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { OfflineChip } from "./OfflineChip";

export function inviteLink(code: string) {
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? (typeof window !== "undefined" ? location.origin : "");
  return `${origin}/r/${code}`;
}

/** Copy the invite link; the icon swaps to a check for 1.6 s (HANDOFF "copy"). */
export function useCopyLink(code: string) {
  const t = useTranslations("toast");
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink(code));
    } catch {
      // clipboard blocked: the toast still tells them the code
    }
    toast(t("linkCopied"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return { copied, copy };
}

type Props = {
  state: RoomState;
  online: Set<string>;
  /** Out of presence for more than 10 s. */
  offline?: Set<string>;
  /** Status text per player for the side panel ("Host", "Done", "7/12", score...). */
  statusFor: (playerId: string) => string;
  /** Results order the side list by score. */
  order?: string[];
  onLeave: () => void;
  children: React.ReactNode;
};

/**
 * In-room frame. Below lg: floating pill header with leave and the code. At lg: a 340 px left
 * panel with the room code, players and status and leave (HANDOFF breakpoints).
 */
export function RoomShell({ state, online, offline, statusFor, order, onLeave, children }: Props) {
  const t = useTranslations("room");
  const c = useTranslations("common");
  const { copied, copy } = useCopyLink(state.room.code);
  const CopyGlyph = copied ? CheckIcon : CopyIcon;
  const players = order
    ? order.map((id) => state.players.find((p) => p.id === id)).filter((p) => p !== undefined)
    : state.players;

  return (
    <div className="flex min-h-[100dvh] overflow-x-clip">
      <aside className="sticky top-0 box-border hidden h-[100dvh] w-[340px] shrink-0 flex-col gap-6 overflow-y-auto border-r border-line bg-surface p-6 lg:flex">
        <Wordmark size={32} />
        <div className="grid gap-2 rounded-card bg-surface-raised p-[18px]">
          <span className="text-[13px] leading-none font-semibold text-text-muted">
            {t("code")}
          </span>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[44px] leading-none font-semibold tracking-[.06em]">
              {state.room.code}
            </span>
            <button
              type="button"
              aria-label={t("copyLink")}
              onClick={copy}
              className="grid size-12 place-items-center rounded-pill border border-line bg-transparent text-[20px] text-text hover:bg-surface-raised active:scale-[.92]"
            >
              <CopyGlyph
                key={String(copied)}
                aria-hidden
                className={copied ? "animate-icon-in" : undefined}
              />
            </button>
          </div>
          <span className="text-[14px] leading-[1.3] font-medium text-text-muted">
            {c("packLine", { pack: state.room.pack.name, count: state.room.questionCount })}
          </span>
        </div>
        <div className="grid gap-1">
          <span className="mb-1.5 text-[13px] leading-none font-semibold text-text-muted">
            {t("players")}
          </span>
          {players.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-1.5">
              <span className="relative">
                <Avatar n={p.avatar} size={32} label={p.nickname} frame={p.frame} />
                {online.has(p.id) && (
                  <span
                    aria-hidden
                    className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-surface bg-success"
                  />
                )}
              </span>
              <span className="flex-1 text-[15px] leading-none font-semibold">
                {p.id === state.me.id ? c("youSuffix", { name: p.nickname }) : p.nickname}
              </span>
              {offline?.has(p.id) && <OfflineChip />}
              <span className="font-mono text-[13px] leading-none font-medium text-text-muted">
                {statusFor(p.id)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-auto grid gap-3">
          <button
            type="button"
            onClick={onLeave}
            className="flex h-12 items-center justify-center gap-2 rounded-pill border-0 bg-transparent text-[15px] leading-none font-semibold text-text-muted hover:bg-surface-raised hover:text-text"
          >
            {c("leaveRoom")}
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col items-center">
        <div
          className={cn(
            "sticky top-3 mx-auto mt-3 box-border flex w-[calc(100%-24px)] max-w-[1160px] items-center justify-between gap-2 rounded-pill border border-line p-1.5 pl-[18px] lg:hidden",
            "bg-[color-mix(in_oklab,var(--surface-raised)_80%,transparent)] shadow-[0_14px_32px_-20px_var(--shadow)] backdrop-blur-[14px] backdrop-saturate-[1.4]",
          )}
          style={{ zIndex: "var(--z-sticky)" }}
        >
          <Wordmark size={24} />
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label={t("leaveAria")}
              onClick={onLeave}
              className="grid size-12 shrink-0 place-items-center rounded-pill border border-line bg-transparent text-[20px] text-text hover:bg-surface-raised active:scale-[.92]"
            >
              <SignOutIcon aria-hidden />
            </button>
            <button
              type="button"
              onClick={copy}
              aria-label={t("copyAria", { code: state.room.code })}
              className="flex h-12 items-center gap-2 rounded-pill border border-line bg-transparent px-4 font-mono text-[15px] leading-none font-semibold tracking-[.06em] text-text hover:bg-surface-raised"
            >
              {state.room.code}
              <CopyGlyph
                key={String(copied)}
                size={16}
                aria-hidden
                className={copied ? "animate-icon-in" : undefined}
              />
            </button>
          </div>
        </div>
        <div className="box-border flex w-full max-w-[520px] flex-1 flex-col px-5 pt-2 pb-6 lg:px-8 lg:pt-12 lg:pb-10">
          {children}
        </div>
      </main>
    </div>
  );
}
