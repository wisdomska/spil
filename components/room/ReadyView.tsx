"use client";

import { CheckIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/brand/Avatar";
import { stickerRot } from "@/components/brand/Stickers";
import { Button } from "@/components/ui/Button";
import type { RoomState } from "@/lib/api/types";

export function ReadyView({
  state,
  onReveal,
  revealing,
}: {
  state: RoomState;
  onReveal: () => void;
  revealing: boolean;
}) {
  const t = useTranslations("ready");
  const c = useTranslations("common");
  const host = state.players.find((p) => p.isHost);
  const players = state.players.filter((p) => p.status === "active" || p.status === "sat_out");
  // Solo: nobody guessed, so the copy talks about the score instead.
  const solo = players.length === 1;
  return (
    <div className="flex flex-1 flex-col justify-center gap-5">
      <div className="flex flex-wrap gap-x-2.5 gap-y-3.5 p-1.5">
        {players.map((p, i) => {
          const you = p.id === state.me.id;
          return (
            <span
              key={p.id}
              className="inline-flex items-center gap-2 rounded-pill border-[3px] border-sticker-edge py-1 pr-3.5 pl-1"
              style={{
                background: you ? "var(--accent)" : "var(--surface-raised)",
                color: you ? "var(--on-accent)" : "var(--text)",
                boxShadow: "0 0 0 1.5px var(--sticker-ring)",
                rotate: `${stickerRot(i)}deg`,
              }}
            >
              <Avatar n={p.avatar} size={34} label={p.nickname} />
              <span className="font-display text-[16px] leading-none font-bold">{p.nickname}</span>
              <CheckIcon size={16} aria-label={c("lockedIn")} />
            </span>
          );
        })}
      </div>
      <h1 className="m-0 font-display text-display-l font-extrabold tracking-display">
        {solo ? t("soloTitle") : t("title")}{" "}
        <span className="text-accent-ink" style={{ fontStretch: "75%" }}>
          {solo ? t("soloEmphasis") : t("titleEmphasis")}
        </span>
      </h1>
      <p className="m-0 text-[17px] leading-[1.5] text-text-muted">
        {solo
          ? t("soloHost")
          : state.me.isHost
            ? t("host")
            : t("guest", { host: host?.nickname ?? "" })}
      </p>
      {state.me.isHost && (
        <Button className="mt-4" block loading={revealing} onClick={onReveal}>
          {t("start")}
        </Button>
      )}
    </div>
  );
}
