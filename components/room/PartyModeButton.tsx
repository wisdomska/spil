"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";

/**
 * Party Mode (Batch 2): the host pairs a big screen. The link carries a secret token, so only
 * screens the host sets up can show the room.
 */
export function PartyModeButton({ code }: { code: string }) {
  const t = useTranslations("lobby");
  const tt = useTranslations("toast");
  const toast = useToast();
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pair = async () => {
    setBusy(true);
    try {
      const { token } = await api<{ token: string }>("POST", `/rooms/${code}/tv`);
      setLink(`${window.location.origin}/r/${code}/tv?t=${token}`);
    } catch {
      toast(tt("somethingWrong"), "err");
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast(tt("linkCopiedTv"));
    } catch {
      toast(tt("somethingWrong"), "err");
    }
  };

  return (
    <>
      <Button variant="ghost" size="md" loading={busy} onClick={pair}>
        {t("partyMode")}
      </Button>
      <Sheet
        open={link !== null}
        onOpenChange={(open) => !open && setLink(null)}
        title={t("partyTitle")}
        description={t("partyBody")}
      >
        <p className="m-0 rounded-input border border-line bg-surface-raised px-3.5 py-3 font-mono text-[13px] leading-[1.4] break-all text-text-muted">
          {link}
        </p>
        <Button onClick={copy}>{t("partyCopy")}</Button>
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="flex h-14 items-center justify-center rounded-pill border-[1.5px] border-text text-[17px] leading-none font-semibold text-text no-underline hover:bg-surface-raised"
          >
            {t("partyOpen")}
          </a>
        )}
      </Sheet>
    </>
  );
}
