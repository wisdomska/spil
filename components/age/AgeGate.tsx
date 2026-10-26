"use client";

import { LockSimpleIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { isRealAge } from "@/lib/game";
import { cn } from "@/lib/cn";

type Props = {
  /** The host sees "Step 1 of 2", a guest "Before you join", Today's Spill "Before you play". */
  who: "host" | "guest" | "player";
  /** Gets the typed age once it is real (1 to 99); the caller keeps only its band. */
  onAge: (years: number) => void;
};

/**
 * "How old are you?" (SPIL-02). A neutral age gate: one empty field, no default, no slider, no
 * hint about 18. The number never leaves this component except to be turned into a band.
 */
export function AgeGate({ who, onAge }: Props) {
  const t = useTranslations("age");
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  const submit = () => {
    if (!value) return;
    const years = Number(value);
    if (!isRealAge(years)) return setError(true);
    onAge(years);
  };

  return (
    <main className="mx-auto box-border flex w-full max-w-[440px] flex-1 flex-col gap-5 px-4 pt-6 pb-7 sm:px-5">
      <span className="font-mono text-[13px] leading-none font-medium text-text-muted">
        {who === "host" ? t("kickerHost") : who === "player" ? t("kickerPlay") : t("kickerGuest")}
      </span>
      <h1 className="m-0 font-display text-display-m leading-[.98] font-extrabold tracking-display text-balance">
        {t("title")}
      </h1>
      <p className="m-0 text-[15px] leading-[1.5] text-pretty text-text-muted">{t("helper")}</p>
      <div className="grid gap-2">
        <label htmlFor="spil-age" className="text-[14px] leading-none font-semibold">
          {t("label")}
        </label>
        <input
          id="spil-age"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          autoComplete="off"
          // One field, one job: focus it so the keyboard path is Type, Enter.
          autoFocus
          value={value}
          aria-invalid={error || undefined}
          aria-describedby={error ? "spil-age-err" : undefined}
          onChange={(e) => {
            setValue(e.target.value.replace(/\D/g, "").slice(0, 2));
            setError(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className={cn(
            "h-24 w-full rounded-input border bg-surface-raised text-center font-display text-[56px] leading-none font-extrabold text-text tabular-nums",
            "focus:ring-2 focus:ring-accent focus:outline-none",
            error ? "border-error" : "border-line",
          )}
        />
        {error && (
          <span
            id="spil-age-err"
            role="alert"
            className="flex items-center gap-1.5 text-[14px] leading-[1.35] text-error"
          >
            <WarningCircleIcon size={18} aria-hidden className="shrink-0" />
            {t("error")}
          </span>
        )}
      </div>
      <div className="mt-auto grid gap-3">
        <Button block softDisabled={!value} onClick={submit}>
          {t("cta")}
        </Button>
        <span className="flex items-center gap-2 text-[14px] leading-[1.4] font-medium text-text-muted">
          <LockSimpleIcon size={18} aria-hidden className="shrink-0" />
          {who === "player" ? t("privacyDevice") : t("privacy")}
        </span>
      </div>
    </main>
  );
}

/** "Playing as 18+ · Not you?" under a title; "Not you?" is hidden while a minor's lock lasts. */
export function PlayingAs({
  band,
  locked,
  onNotYou,
}: {
  band: "13_15" | "16_17" | "18_plus";
  locked: boolean;
  onNotYou: () => void;
}) {
  const t = useTranslations("age");
  const label = band === "13_15" ? t("band13") : band === "16_17" ? t("band16") : t("band18");
  return (
    <p className="m-0 flex flex-wrap items-center gap-x-1.5 text-[14px] leading-[1.4] text-text-muted">
      <span>{t("playingAs", { band: label })}</span>
      {!locked && (
        <>
          <span aria-hidden>·</span>
          <button
            type="button"
            onClick={onNotYou}
            className="min-h-11 border-0 bg-transparent p-0 text-[14px] font-semibold text-text underline-offset-4 hover:underline"
          >
            {t("notYou")}
          </button>
        </>
      )}
    </p>
  );
}
