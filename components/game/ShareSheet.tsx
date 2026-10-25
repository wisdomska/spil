"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import type { AwardKey } from "@/components/brand/Stickers";
import { Button } from "@/components/ui/Button";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { Sheet } from "@/components/ui/Sheet";
import { SwitchRow } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { cardToBlob, downloadBlob, shareOrSave } from "@/lib/share/capture";
import { useCardCopy } from "@/lib/share/useCardCopy";
import { ShareCard, type BoardRow } from "./ShareCard";
import { track } from "@/lib/analytics/posthog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: string;
  pack?: string;
  name: string;
  avatar: number;
  /** Batch 3: the card look I unlocked and chose. */
  look?: "night" | "raised" | "accent";
  score: number;
  /** Absent when I won no award (SPIL-13). */
  award?: AwardKey;
  board: BoardRow[];
  boardAward?: { award: AwardKey; name: string };
  hideName: boolean;
  onHideName: (hide: boolean) => void;
};

/** "Your card": story or group format, hide my name, save or share the PNG (spec section 16). */
export function ShareSheet(props: Props) {
  const t = useTranslations("share");
  const tt = useTranslations("toast");
  const toast = useToast();
  const copy = useCardCopy();
  const [format, setFormat] = useState<"story" | "group">("story");
  const [busy, setBusy] = useState<"save" | "share" | null>(null);
  const capture = useRef<HTMLDivElement>(null);
  const cardFormat = format === "story" ? "story" : "square";
  const cardProps = {
    theme: "dark" as const,
    look: props.look,
    room: props.room,
    pack: props.pack,
    name: props.name,
    hideName: props.hideName,
    avatar: props.avatar,
    score: props.score,
    award: props.award,
    board: props.board,
    boardAward: props.boardAward,
    copy,
  };
  const filename = `spil-${props.room}-${format}.png`;
  const link = `${process.env.NEXT_PUBLIC_SITE_URL ?? location.origin}/r/${props.room}?ref=share&utm_source=card`;

  const run = async (kind: "save" | "share") => {
    if (!capture.current) return;
    track("share_clicked", { format, action: kind });
    setBusy(kind);
    try {
      const blob = await cardToBlob(capture.current);
      if (kind === "save") {
        downloadBlob(blob, filename);
        toast(tt("cardSaved"));
      } else {
        const result = await shareOrSave(blob, filename, t("text"), link);
        if (result === "saved") toast(tt("savedInstead"), "info");
      }
    } catch {
      toast(tt("somethingWrong"), "err");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange} title={t("title")} closeButton>
      <SegmentedTabs
        label={t("size")}
        value={format}
        onValueChange={setFormat}
        items={[
          { value: "story", label: t("story") },
          { value: "group", label: t("group") },
        ]}
      />
      <div className="flex justify-center py-1">
        <ShareCard format={cardFormat} scale={format === "story" ? 0.2 : 0.33} {...cardProps} />
      </div>
      {format === "story" && (
        <SwitchRow
          look="plain"
          checked={props.hideName}
          onCheckedChange={props.onHideName}
          title={t("hideName")}
        />
      )}
      <div className="flex gap-2.5">
        <Button
          variant="secondary"
          className="flex-1"
          loading={busy === "save"}
          onClick={() => run("save")}
        >
          {t("save")}
        </Button>
        <Button className="flex-1" loading={busy === "share"} onClick={() => run("share")}>
          {t("share")}
        </Button>
      </div>
      {/* Full-size copy for capture at 1x, kept off screen. */}
      <div aria-hidden className="pointer-events-none fixed top-0 -left-[10000px]">
        <ShareCard ref={capture} format={cardFormat} {...cardProps} />
      </div>
    </Sheet>
  );
}
