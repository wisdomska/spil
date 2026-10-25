"use client";

import { LockSimpleIcon, WarningCircleIcon } from "@phosphor-icons/react";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useBusy } from "@/lib/useBusy";
import { AgeGate, PlayingAs } from "@/components/age/AgeGate";
import { Avatar, AVATAR_COUNT } from "@/components/brand/Avatar";
import { ErrorScreen, type ErrorVariant } from "@/components/site/ErrorScreen";
import { Button } from "@/components/ui/Button";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { playableBand, useDeviceAge } from "@/lib/age/device";
import { api, ClientApiError, ensureSession } from "@/lib/api/client";
import type { PublicRoom } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { track } from "@/lib/analytics/posthog";
import { clearProfile, readProfile, saveProfile } from "@/lib/profile/device";
import { bandFloor } from "@/lib/game";

const ROOM_ERRORS: Record<string, ErrorVariant> = {
  ROOM_NOT_FOUND: "notfound",
  ROOM_EXPIRED: "expired",
  ROOM_FULL: "full",
  GAME_STARTED: "started",
  OFFLINE: "offline",
};

/**
 * Age (once per device, SPIL-02), then nickname and face. First player in becomes the host. A
 * guest below the room's minimum age gets the "18+ room" screen and no player row is made.
 */
export function ProfileForm({ code, initialRoom }: { code: string; initialRoom?: PublicRoom }) {
  const t = useTranslations("profile");
  const router = useRouter();
  // SPIL-17: the last name and face used on this phone, so the next room needs no typing.
  const [saved, setSaved] = useState(() => readProfile(AVATAR_COUNT));
  const [nick, setNick] = useState(saved?.nickname ?? "");
  const [avatar, setAvatar] = useState(
    () => saved?.avatar ?? Math.floor(Math.random() * AVATAR_COUNT),
  );
  const [nickErr, setNickErr] = useState<string | null>(null);
  const [roomErr, setRoomErr] = useState<ErrorVariant | null>(null);
  const [busy, setBusy] = useBusy();
  const { band: stored, locked, setAge, clearAge } = useDeviceAge();
  const band = playableBand(stored);

  const room = useQuery({
    queryKey: ["room-public", code],
    queryFn: () => api<PublicRoom>("GET", `/rooms/${code}`),
    // SPIL-19: the server already read it; this refetch only adds "joined" for this device.
    initialData: initialRoom,
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
  if (stored === "under_13") return <ErrorScreen variant="tooYoung" />;

  if (!room.data || stored === undefined) {
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

  const isHost = room.data.playerCount === 0;
  if (!band)
    return (
      <AgeGate who={isHost ? "host" : "guest"} onAge={(y) => setAge(y, room.data.ageLockHours)} />
    );
  // The room's pack is above this band: say so before the form, and never tell the host.
  if (bandFloor(band) < room.data.minAge) return <ErrorScreen variant="ageRestricted" />;
  const valid = nick.trim().length >= 2;

  const submit = async () => {
    if (busy) return;
    if (nick.trim().length < 2) return setNickErr(t("errLength"));
    setBusy(true);
    try {
      await ensureSession();
      await api("POST", `/rooms/${code}/join`, {
        nickname: nick,
        avatar,
        ageBand: band,
      });
      saveProfile({ nickname: nick, avatar });
      track("player_joined", { pack: room.data.pack.id, isHost });
      router.replace(`/r/${code}`);
    } catch (e) {
      const c = e instanceof ClientApiError ? e.code : "";
      setBusy(false);
      if (c === "NAME_TAKEN") return setNickErr(t("errTaken"));
      if (c === "NAME_INVALID") return setNickErr(t("errInvalid"));
      if (c === "AGE_RESTRICTED") return setRoomErr("ageRestricted");
      if (c === "AGE_TOO_YOUNG") return setRoomErr("tooYoung");
      if (ROOM_ERRORS[c]) return setRoomErr(ROOM_ERRORS[c]!);
      if (c === "NOT_IN_ROOM") return setRoomErr("removed");
      setRoomErr("server");
    }
  };

  return (
    <main className="mx-auto box-border flex w-full max-w-[480px] flex-1 flex-col gap-[22px] px-5 pt-4 pb-7">
      <div className="grid gap-2.5">
        <h1 className="m-0 font-display text-[40px] leading-[.96] font-extrabold tracking-display">
          {t("title")}
        </h1>
        <PlayingAs band={band} locked={locked} onNotYou={clearAge} />
      </div>
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="spil-nick" className="text-[14px] leading-none font-semibold">
            {t("nickname")}
          </label>
          {saved && (
            <button
              type="button"
              aria-label={t("notYouAria")}
              onClick={() => {
                clearProfile();
                setSaved(null);
                setNick("");
                setNickErr(null);
                setAvatar(Math.floor(Math.random() * AVATAR_COUNT));
              }}
              className="border-0 bg-transparent p-0 text-[14px] leading-none font-semibold text-text-muted underline underline-offset-4 hover:text-text"
            >
              {t("notYou")}
            </button>
          )}
        </div>
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
      <div className="mt-auto grid gap-2.5">
        <span className="flex items-center gap-2 text-[14px] leading-[1.4] font-medium text-text-muted">
          <LockSimpleIcon size={18} aria-hidden />
          {t("noSignup")}
        </span>
        <Button block softDisabled={!valid} loading={busy} onClick={submit}>
          {isHost ? t("openLobby") : t("joinRoom")}
        </Button>
      </div>
    </main>
  );
}
