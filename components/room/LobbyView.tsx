"use client";

import {
  CheckCircleIcon,
  CrownSimpleIcon,
  UsersThreeIcon,
  XIcon,
  QrCodeIcon,
} from "@phosphor-icons/react";
import { useReducedMotion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Avatar } from "@/components/brand/Avatar";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import type { RoomState } from "@/lib/api/types";
import { countOptions, rotationFor } from "@/lib/game";
import { cn } from "@/lib/cn";
import { CustomQuestions } from "./CustomQuestions";
import { InviteSheet } from "./InviteSheet";
import { QrCode } from "./QrCode";
import { PartyModeButton } from "./PartyModeButton";
import { inviteLink, useCopyLink } from "./RoomShell";

type Props = {
  state: RoomState;
  onStart: () => void;
  starting: boolean;
  onKick: (id: string, name: string) => void;
  onAddTest: () => void;
  /** Two-step setup: the host changes the length here. */
  onLength?: (questionCount: number) => void;
  lengthBusy?: boolean;
};

export function LobbyView({
  state,
  onStart,
  starting,
  onKick,
  onAddTest,
  onLength,
  lengthBusy,
}: Props) {
  const t = useTranslations("lobby");
  const tr = useTranslations("room");
  const tt = useTranslations("toast");
  const c = useTranslations("common");
  const toast = useToast();
  const reduced = useReducedMotion();
  const { copied, copy } = useCopyLink(state.room.code);
  const { me, room, players } = state;
  const isHost = me.isHost;
  const host = players.find((p) => p.isHost);
  const active = players.filter((p) => p.status === "active");
  const n = active.length;
  const canStart = n >= room.settings.minPlayers;
  const link = inviteLink(room.code);
  const shareText = tr("shareText", { code: room.code });

  const [inviting, setInviting] = useState(false);
  const [showQr, setShowQr] = useState(false);

  return (
    <div className="flex flex-1 flex-col gap-[26px]">
      <div className="grid gap-2.5">
        <span className="text-[14px] leading-none font-semibold text-text-muted lg:hidden">
          {tr("code")}
        </span>
        <span className="font-mono text-[76px] leading-none font-semibold tracking-[.06em] lg:hidden">
          {room.code}
        </span>
        {/* SPIL-28: on desktop the sidebar has the code, so the main column shows a QR. */}
        <figure className="m-0 hidden w-fit justify-items-center gap-2.5 rounded-card bg-inverse p-4 text-on-inverse lg:grid">
          <QrCode value={link} size={168} label={t("qrAria", { code: room.code })} />
          <figcaption className="text-[14px] leading-none font-semibold">
            {t("scanToJoin")}
          </figcaption>
        </figure>
        <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <button
            type="button"
            onClick={() => setInviting(true)}
            className="flex h-14 items-center justify-center gap-2 rounded-pill border-[1.5px] border-text bg-transparent px-[18px] text-[17px] leading-none font-semibold whitespace-nowrap text-text hover:bg-surface-raised"
          >
            {tr("shareInvite")}
          </button>
          <button
            type="button"
            onClick={copy}
            className="flex h-14 items-center justify-center gap-2 rounded-pill border border-line bg-transparent px-5 text-[15px] leading-none font-semibold whitespace-nowrap text-text hover:bg-surface-raised"
          >
            {copied ? tr("copied") : tr("copyLink")}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowQr(true)}
          className="-ml-2 flex h-12 items-center gap-2 justify-self-start rounded-pill border-0 bg-transparent px-4 text-[15px] leading-none font-semibold whitespace-nowrap text-text hover:bg-surface-raised lg:hidden"
        >
          <QrCodeIcon size={20} aria-hidden />
          {t("showQr")}
        </button>
        <Sheet open={showQr} onOpenChange={setShowQr} title={t("scanToJoin")} closeButton>
          <div className="grid justify-items-center gap-3 rounded-card bg-inverse p-5 text-on-inverse">
            <QrCode value={link} size={280} label={t("qrAria", { code: room.code })} />
            <span className="font-mono text-[40px] leading-none font-semibold tracking-[.06em]">
              {room.code}
            </span>
          </div>
        </Sheet>
        <InviteSheet
          open={inviting}
          onOpenChange={setInviting}
          code={room.code}
          link={link}
          text={shareText}
        />
      </div>

      <div className="grid gap-3.5">
        <div className="flex items-baseline justify-between">
          <h2 className="m-0 font-display text-[26px] leading-none font-extrabold tracking-[-.02em]">
            {t("inRoom")}
          </h2>
          <span className="font-mono text-[14px] leading-none font-medium text-text-muted">
            {t("count", { n, max: room.settings.maxPlayers })}
          </span>
        </div>
        <div
          aria-live="polite"
          className="flex min-h-[130px] flex-wrap content-start gap-x-2.5 gap-y-4 px-0.5 py-1.5"
        >
          {active.map((p) => {
            const you = p.id === me.id;
            const removable = isHost && !p.isHost;
            return (
              <span
                key={p.id}
                className={reduced ? undefined : "animate-lobby-drop"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: removable ? "5px 6px 5px 5px" : "5px 18px 5px 5px",
                  borderRadius: 999,
                  background: you ? "var(--accent)" : "var(--surface-raised)",
                  color: you ? "var(--on-accent)" : "var(--text)",
                  border: "3px solid var(--sticker-edge)",
                  boxShadow: "0 0 0 1.5px var(--sticker-ring), 0 8px 16px -10px var(--shadow)",
                  rotate: `${rotationFor(p.rotationSeed)}deg`,
                }}
              >
                <Avatar n={p.avatar} size={40} label={p.nickname} frame={p.frame} />
                <span className="font-display text-[18px] leading-none font-bold">
                  {p.nickname}
                </span>
                {p.isHost && <CrownSimpleIcon size={18} aria-label={c("host")} />}
                {removable && (
                  <button
                    type="button"
                    aria-label={t("remove", { name: p.nickname })}
                    onClick={() => onKick(p.id, p.nickname)}
                    className="-my-1.5 -mr-2.5 -ml-1 grid size-12 place-items-center rounded-pill border-0 bg-transparent text-inherit hover:bg-surface-raised"
                  >
                    <span className="grid size-[30px] place-items-center rounded-pill bg-bg text-text">
                      <XIcon size={15} aria-hidden />
                    </span>
                  </button>
                )}
              </span>
            );
          })}
        </div>
        {n === 1 && <p className="m-0 text-[17px] leading-[1.5] text-text-muted">{t("alone")}</p>}
      </div>

      <div className="mt-auto grid gap-2.5">
        {isHost ? (
          <>
            <SetupCard state={state} onLength={onLength} busy={lengthBusy} />
            <span className="flex items-center gap-2 text-[15px] leading-[1.4] font-medium text-text-muted">
              {canStart ? (
                <CheckCircleIcon size={18} aria-hidden />
              ) : (
                <UsersThreeIcon size={18} aria-hidden />
              )}
              {canStart
                ? n === 1
                  ? t("readySolo")
                  : t("ready", { n })
                : t("need", { min: room.settings.minPlayers, n })}
            </span>
            <Button
              block
              softDisabled={!canStart}
              loading={starting}
              onClick={() =>
                canStart
                  ? onStart()
                  : toast(
                      room.testPlayers
                        ? tt("needPlayers", { min: room.settings.minPlayers })
                        : tt("needPlayersProd", { min: room.settings.minPlayers }),
                      "err",
                    )
              }
            >
              {/* Owner request: one player plays solo, and the button says so. */}
              {n === 1 && canStart ? t("playSolo") : t("start")}
            </Button>
            {room.testPlayers && (
              <Button variant="ghost" size="md" onClick={onAddTest}>
                {t("addTest")}
              </Button>
            )}
            {room.partyMode && <PartyModeButton code={room.code} />}
            {room.customAllowed && <CustomQuestions code={room.code} />}
          </>
        ) : (
          <div
            role="status"
            className="flex items-center gap-3.5 rounded-card border border-line bg-surface p-4"
          >
            {host && <Avatar n={host.avatar} size={44} label={host.nickname} />}
            <span className="text-[16px] leading-[1.4] font-medium">
              {t("guestWait", { host: host?.nickname ?? "" })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Two-step setup, in the lobby: the game and pack with one way to change them, and the length
 * as chips. A mis-tap on a one-tap game on /create costs one tap to undo here.
 */
function SetupCard({
  state,
  onLength,
  busy,
}: {
  state: RoomState;
  onLength?: (n: number) => void;
  busy?: boolean;
}) {
  const t = useTranslations("lobby");
  const tm = useTranslations("modes");
  const { room } = state;
  const total = room.packQuestions ?? 0;
  // A room's own custom questions keep their length; there is nothing to pick.
  const custom = room.pack.id.startsWith("custom_");
  const options = !custom && onLength && total > 0 ? countOptions(total) : [];
  return (
    <section
      aria-labelledby="lobby-setup"
      className="grid gap-3.5 rounded-card border border-line bg-surface p-4"
    >
      <h2 id="lobby-setup" className="sr-only">
        {t("setupLabel")}
      </h2>
      <div className="flex items-center justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <span className="text-[13px] leading-none text-text-muted">{t("setupGame")}</span>
          <span className="truncate text-[17px] leading-[1.25] font-semibold">
            {tm(`${room.mode}.name`)}
            <span className="font-normal text-text-muted"> · {room.pack.name}</span>
          </span>
        </div>
        <Link
          href={`/create?room=${room.code}&mode=pack&current=${room.mode}&pack=${room.pack.id}`}
          aria-label={t("setupChangeAria", { game: tm(`${room.mode}.name`) })}
          className="flex h-11 shrink-0 items-center rounded-pill border border-line px-4 text-[15px] leading-none font-semibold text-text no-underline hover:bg-surface-raised hover:text-text"
        >
          {t("setupChange")}
        </Link>
      </div>
      {options.length > 1 && (
        <div className="grid gap-2">
          <span id="lobby-length" className="text-[13px] leading-none text-text-muted">
            {t("setupQuestions")}
          </span>
          <div role="radiogroup" aria-labelledby="lobby-length" className="flex flex-wrap gap-1.5">
            {options.map((n) => {
              const on = n === room.questionCount;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-disabled={busy || undefined}
                  onClick={() => !on && !busy && onLength?.(n)}
                  className={cn(
                    "h-10 min-w-11 rounded-pill border-[1.5px] px-3 text-[14px] leading-none font-semibold tabular-nums",
                    on
                      ? "border-accent bg-accent-soft text-accent-ink"
                      : "border-line-strong bg-transparent text-text hover:border-text",
                    busy && !on && "opacity-60",
                  )}
                >
                  {n === total ? t("setupAll", { n }) : n}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
