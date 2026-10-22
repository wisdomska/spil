"use client";

import { LockSimpleIcon, WarningCircleIcon } from "@phosphor-icons/react";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Avatar, AVATAR_COUNT } from "@/components/brand/Avatar";
import { ErrorScreen, type ErrorVariant } from "@/components/site/ErrorScreen";
import { Button } from "@/components/ui/Button";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { SwitchRow } from "@/components/ui/Switch";
import { useTurnstile } from "@/components/ui/Turnstile";
import { api, ClientApiError, ensureSession } from "@/lib/api/client";
import type { PublicRoom } from "@/lib/api/types";
import { cn } from "@/lib/cn";

const ROOM_ERRORS: Record<string, ErrorVariant> = {
  ROOM_NOT_FOUND: "notfound",
  ROOM_EXPIRED: "expired",
  ROOM_FULL: "full",
  GAME_STARTED: "started",
  OFFLINE: "offline",
};

/** Nickname, face and (adult packs) the 18+ switch. First player in becomes the host. */
export function ProfileForm({ code }: { code: string }) {
  const t = useTranslations("profile");
  const router = useRouter();
  const { getToken, element } = useTurnstile();
  const [nick, setNick] = useState("");
  const [avatar, setAvatar] = useState(() => Math.floor(Math.random() * AVATAR_COUNT));
  const [age, setAge] = useState(false);
  const [ageErr, setAgeErr] = useState(false);
  const [nickErr, setNickErr] = useState<string | null>(null);
  const [roomErr, setRoomErr] = useState<ErrorVariant | null>(null);
  const [busy, setBusy] = useState(false);

  const room = useQuery({
    queryKey: ["room-public", code],
    queryFn: () => api<PublicRoom>("GET", `/rooms/${code}`),
    retry: false,
  });

  // Already in this room on this device: go straight back to it.
  useEffect(() => {
    if (room.data?.joined) router.replace(`/r/${code}`);
  }, [room.data?.joined, router, code]);

  const loadError =
    room.error instanceof ClientApiError
      ? ROOM_ERRORS[room.error.code]
      : room.error
        ? "notfound"
        : null;
  const shownError = roomErr ?? loadError ?? null;
  if (shownError) return <ErrorScreen variant={shownError} maxPlayers={room.data?.maxPlayers} />;

  if (!room.data) {
    return (
      <main className="mx-auto box-border w-full max-w-[480px] px-5 pt-4">
        <SkeletonGroup label={t("title")} className="gap-4">
          <Skeleton className="h-20 w-full rounded-input" />
          <Skeleton className="h-14 w-full rounded-input" />
          <Skeleton className="h-[220px] w-full rounded-card" />
        </SkeletonGroup>
      </main>
    );
  }

  const adult = room.data.pack.isAdult;
  const isHost = room.data.playerCount === 0;
  const valid = nick.trim().length >= 2 && (!adult || age);

  const submit = async () => {
    if (busy) return;
    if (nick.trim().length < 2) return setNickErr(t("errLength"));
    if (adult && !age) return setAgeErr(true);
    setBusy(true);
    try {
      await ensureSession(getToken);
      await api("POST", `/rooms/${code}/join`, {
        nickname: nick,
        avatar,
        ageConfirmed: adult ? age : false,
      });
      router.replace(`/r/${code}`);
    } catch (e) {
      const c = e instanceof ClientApiError ? e.code : "";
      setBusy(false);
      if (c === "NAME_TAKEN") return setNickErr(t("errTaken"));
      if (c === "NAME_INVALID") return setNickErr(t("errInvalid"));
      if (c === "AGE_REQUIRED") return setAgeErr(true);
      if (ROOM_ERRORS[c]) return setRoomErr(ROOM_ERRORS[c]!);
      if (c === "NOT_IN_ROOM") return setRoomErr("removed");
      setRoomErr("server");
    }
  };

  return (
    <main className="mx-auto box-border flex w-full max-w-[480px] flex-1 flex-col gap-[22px] px-5 pt-4 pb-7">
      <h1 className="m-0 font-display text-[40px] leading-[.96] font-extrabold tracking-display">
        {t("title")}
      </h1>
      <div className="grid gap-2">
        <label htmlFor="spil-nick" className="text-[14px] leading-none font-semibold">
          {t("nickname")}
        </label>
        <input
          id="spil-nick"
          value={nick}
          maxLength={16}
          autoComplete="nickname"
          placeholder={t("placeholder")}
          aria-invalid={nickErr ? true : undefined}
          aria-describedby="spil-nick-msg"
          onChange={(e) => {
            setNick(e.target.value.slice(0, 16));
            setNickErr(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className={cn(
            "h-14 rounded-input border-[1.5px] bg-surface px-4 text-[17px] leading-none font-medium text-text",
            nickErr ? "border-error" : "border-line-strong",
          )}
        />
        <span
          id="spil-nick-msg"
          className={cn(
            "flex items-center gap-1.5 text-[14px] leading-[1.35]",
            nickErr ? "text-error" : "text-text-muted",
          )}
        >
          {nickErr && <WarningCircleIcon size={18} aria-hidden className="shrink-0" />}
          {nickErr ?? t("help")}
        </span>
      </div>
      <fieldset className="m-0 grid gap-3 border-0 p-0">
        <legend className="mb-3 p-0 text-[14px] leading-none font-semibold">{t("face")}</legend>
        <RadioGroup.Root
          aria-label={t("avatarGroup")}
          value={String(avatar)}
          onValueChange={(v) => setAvatar(Number(v))}
          className="grid grid-cols-6 gap-x-1 gap-y-1.5"
        >
          {Array.from({ length: AVATAR_COUNT }, (_, i) => (
            <RadioGroup.Item
              key={i}
              value={String(i)}
              aria-label={`Avatar ${i + 1}`}
              className="grid h-[54px] place-items-center rounded-pill border-0 bg-transparent p-0 hover:bg-surface-raised"
            >
              <Avatar n={i} size={42} selected={avatar === i} decorative />
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>
      </fieldset>
      {adult && (
        <SwitchRow
          checked={age}
          onCheckedChange={(v) => {
            setAge(v);
            setAgeErr(false);
          }}
          invalid={ageErr}
          title={t("adult")}
          description={t("adultBody", { pack: room.data.pack.name })}
        />
      )}
      <div className="mt-auto grid gap-2.5">
        <span className="flex items-center gap-2 text-[14px] leading-[1.4] font-medium text-text-muted">
          <LockSimpleIcon size={18} aria-hidden />
          {t("noSignup")}
        </span>
        <Button block softDisabled={!valid} loading={busy} onClick={submit}>
          {isHost ? t("openLobby") : t("joinRoom")}
        </Button>
      </div>
      {element}
    </main>
  );
}
