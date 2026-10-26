"use client";

import { CheckIcon, CopyIcon, KeyIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

/** The one-time recovery code: shown once, copied or written down, then confirmed. */
export function RecoveryCode({ code, onDone }: { code: string; onDone: () => void }) {
  const t = useTranslations("account");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <section
      aria-labelledby="recovery-title"
      className="grid gap-4 rounded-card border-[1.5px] border-accent bg-accent-soft p-5"
    >
      <h2
        id="recovery-title"
        className="m-0 flex items-center gap-2.5 font-display text-[24px] leading-none font-extrabold tracking-[-.02em]"
      >
        <KeyIcon aria-hidden size={24} weight="bold" className="text-accent-ink" />
        {t("codeTitle")}
      </h2>
      <p className="m-0 text-[15px] leading-[1.45] text-pretty">{t("codeBody")}</p>
      <p
        data-testid="recovery-code"
        className="m-0 rounded-input border-[1.5px] border-line-strong bg-surface px-4 py-3.5 text-center font-mono text-[22px] leading-none font-semibold tracking-[.08em] break-all select-all"
      >
        {code}
      </p>
      <Button
        variant="secondary"
        block
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
          } catch {}
        }}
      >
        {copied ? <CheckIcon aria-hidden size={18} /> : <CopyIcon aria-hidden size={18} />}
        {copied ? t("copied") : t("copy")}
      </Button>
      <label className="flex min-h-12 cursor-pointer items-center gap-3 text-[15px] leading-[1.35] font-semibold">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          className="size-5 shrink-0 accent-accent"
        />
        {t("codeSaved")}
      </label>
      <Button block softDisabled={!saved} onClick={() => saved && onDone()}>
        {t("done")}
      </Button>
    </section>
  );
}
