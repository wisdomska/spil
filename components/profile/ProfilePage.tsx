"use client";

import { CheckCircleIcon, LockSimpleIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { AccountSection } from "@/components/account/AccountSection";
import { AVATAR_COUNT } from "@/components/brand/Avatar";
import { FacePicker } from "@/components/profile/FacePicker";
import { Button } from "@/components/ui/Button";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { useDeviceAge } from "@/lib/age/device";
import { cn } from "@/lib/cn";
import { offeredAvatars, randomAvatar } from "@/lib/game";
import { clearProfile, readProfile, saveProfile } from "@/lib/profile/device";

const noop = () => () => {};

/**
 * Profile settings (owner request 2026-10-26): the name and face this phone fills in for the next
 * room (SPIL-17). Stored on the phone only; nothing is sent until a room is joined.
 */
export function ProfilePage() {
  const t = useTranslations("profilePage");
  // The saved name lives in this phone's storage, so the form waits for the browser.
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  return (
    <main className="mx-auto box-border flex w-full max-w-[480px] flex-1 flex-col gap-[22px] px-5 pt-4 pb-10">
      <div className="grid gap-2.5">
        <h1 className="m-0 font-display text-[40px] leading-[.96] font-extrabold tracking-display">
          {t("title")}
        </h1>
        <p className="m-0 text-[16px] leading-[1.5] text-pretty text-text-muted">{t("lede")}</p>
      </div>
      {mounted ? (
        <>
          <ProfileForm />
          <AccountSection />
        </>
      ) : (
        <SkeletonGroup label={t("title")} className="gap-4">
          <Skeleton className="h-20 w-full rounded-input" />
          <Skeleton className="h-[220px] w-full rounded-card" />
        </SkeletonGroup>
      )}
    </main>
  );
}

function ProfileForm() {
  const t = useTranslations("profilePage");
  const tp = useTranslations("profile");
  const [saved, setSaved] = useState(() => readProfile(AVATAR_COUNT));
  const [nick, setNick] = useState(saved?.nickname ?? "");
  const [fallback] = useState(() => randomAvatar());
  const [avatar, setAvatar] = useState(saved?.avatar ?? fallback);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<"saved" | "forgotten" | null>(null);
  const { band } = useDeviceAge();
  // SPIL-26: Hot face only on an 18+ phone.
  const faces = offeredAvatars(band === "18_plus");
  const face = faces.includes(avatar) ? avatar : fallback;

  const save = () => {
    const name = nick.trim();
    if (name.length < 2) return setErr(tp("errLength"));
    saveProfile({ nickname: name, avatar: face });
    setSaved({ nickname: name, avatar: face });
    setNote("saved");
  };

  const forget = () => {
    clearProfile();
    setSaved(null);
    setNick("");
    setAvatar(fallback);
    setErr(null);
    setNote("forgotten");
  };

  return (
    <>
      <div className="grid gap-2">
        <label htmlFor="spil-profile-nick" className="text-[14px] leading-none font-semibold">
          {tp("nickname")}
        </label>
        <input
          id="spil-profile-nick"
          value={nick}
          maxLength={16}
          autoComplete="nickname"
          placeholder={t("placeholder")}
          aria-invalid={err ? true : undefined}
          aria-describedby="spil-profile-nick-msg"
          onChange={(e) => {
            setNick(e.target.value.slice(0, 16));
            setErr(null);
            setNote(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className={cn(
            "h-14 rounded-input border-[1.5px] bg-surface px-4 text-[17px] leading-none font-medium text-text",
            err ? "border-error" : "border-line-strong",
          )}
        />
        <span
          id="spil-profile-nick-msg"
          className={cn(
            "flex items-center gap-1.5 text-[14px] leading-[1.35]",
            err ? "text-error" : "text-text-muted",
          )}
        >
          {err && <WarningCircleIcon size={18} aria-hidden className="shrink-0" />}
          {err ?? t("help")}
        </span>
      </div>
      <FacePicker
        faces={faces}
        value={face}
        onChange={(f) => {
          setAvatar(f);
          setNote(null);
        }}
      />
      <div className="grid gap-3">
        <p
          role="status"
          className="m-0 flex min-h-5 items-center gap-2 text-[14px] leading-[1.4] font-medium text-text-muted"
        >
          {note && <CheckCircleIcon aria-hidden size={18} className="shrink-0 text-success" />}
          {note && t(note)}
        </p>
        <Button block onClick={save}>
          {t("save")}
        </Button>
        {saved && (
          <button
            type="button"
            onClick={forget}
            className="h-12 border-0 bg-transparent text-[15px] leading-none font-semibold text-text-muted underline underline-offset-4 hover:text-text"
          >
            {t("forget")}
          </button>
        )}
        <span className="flex items-center gap-2 text-[14px] leading-[1.4] font-medium text-text-muted">
          <LockSimpleIcon size={18} aria-hidden />
          {t("deviceNote")}
        </span>
      </div>
    </>
  );
}
