"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { AgeGate, PlayingAs } from "@/components/age/AgeGate";
import { PackPicker } from "@/components/game/PackPicker";
import { ErrorScreen } from "@/components/site/ErrorScreen";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useTurnstile } from "@/components/ui/Turnstile";
import { playableBand, useDeviceAge } from "@/lib/age/device";
import { api, ClientApiError, ensureSession } from "@/lib/api/client";
import type { Pack } from "@/lib/api/types";
import { track } from "@/lib/analytics/posthog";
import { bandFloor } from "@/lib/game";
import { useBusy } from "@/lib/useBusy";

type Props = {
  /** The 13+ packs, rendered on the server; safe for every band. */
  packs: Pack[];
  questionsPerGame: number;
  ageLockHours: number;
};

/**
 * Host flow: age first (SPIL-02), then pick a pack and length, then the room is created and the
 * host sets up their profile. With ?room=CODE&mode=pack|rematch the same picker changes an
 * existing room's pack, limited to what its youngest player may play.
 */
export function CreateRoom({ packs: everyone, questionsPerGame, ageLockHours }: Props) {
  const t = useTranslations("packs");
  const tt = useTranslations("toast");
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const room = params.get("room");
  const mode = params.get("mode");
  const inRoom = Boolean(room && (mode === "pack" || mode === "rematch"));
  const { getToken, element, challenge, showChallenge } = useTurnstile();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useBusy();
  const { band: stored, locked, setAge, clearAge } = useDeviceAge();
  const band = playableBand(stored);
  const floor = band ? bandFloor(band) : 13;

  // Older bands may see more than the 13+ packs the page rendered with.
  const forBand = useQuery({
    queryKey: ["packs", floor],
    queryFn: () => api<Pack[]>("GET", `/packs?band=${band}`),
    enabled: !inRoom && floor > 13,
  });
  // In a room the server decides from its youngest player and never names them.
  const forRoom = useQuery({
    queryKey: ["room-packs", room],
    queryFn: () => api<{ packs: Pack[]; someHidden: boolean }>("GET", `/rooms/${room}/packs`),
    enabled: inRoom,
  });
  const packs = inRoom ? forRoom.data?.packs : floor > 13 ? forBand.data : everyone;

  /** Every failure ends with a message: inline under Continue and as a toast (SPIL-05). */
  const failWith = (message: string) => {
    setError(message);
    toast(message, "err");
    setBusy(false);
  };

  const go = async (packId: string, questionCount: number) => {
    if (!band) return;
    setError(null);
    setBusy(true);
    try {
      if (inRoom) {
        if (mode === "rematch")
          track("rematch_started", { packChanged: packId !== params.get("pack") });
        if (mode === "pack") await api("PATCH", `/rooms/${room}/pack`, { packId, questionCount });
        else await api("POST", `/rooms/${room}/rematch`, { packId, questionCount });
        router.push(`/r/${room}`);
        return;
      }
      // Only room creation is bot-checked (server side); signing in anonymously is not, so the
      // single-use Turnstile token is spent on the request that needs it.
      await ensureSession();
      const captchaToken = await getToken();
      // No token within 5 s: never submit empty; show the visible check instead.
      if (captchaToken === undefined) {
        showChallenge();
        return failWith(tt("botCheck"));
      }
      const { code } = await api<{ code: string }>("POST", "/rooms", {
        ageBand: band,
        packId,
        questionCount,
        captchaToken: captchaToken || undefined,
      });
      track("room_created", { pack: packId, questionCount });
      router.push(`/r/${code}/me`);
    } catch (e) {
      const code = e instanceof ClientApiError ? e.code : "";
      if (code === "CAPTCHA_FAILED") showChallenge();
      failWith(
        code === "CAPTCHA_FAILED"
          ? tt("botCheck")
          : code === "RATE_LIMITED"
            ? tt("rateLimited")
            : code === "OFFLINE"
              ? tt("offline")
              : code === "PACK_UNAVAILABLE"
                ? tt("noPacks")
                : code === "PACK_NOT_ALLOWED"
                  ? tt("packNotAllowed")
                  : tt("somethingWrong"),
      );
    }
  };

  if (stored === undefined) return <PickerSkeleton label={t("group")} />;
  if (stored === "under_13") return <ErrorScreen variant="tooYoung" />;
  if (!band) return <AgeGate who="host" onAge={(years) => setAge(years, ageLockHours)} />;

  return (
    <main className="mx-auto box-border flex w-full max-w-[880px] flex-1 flex-col gap-5 px-5 pt-4">
      <div className="grid gap-2.5">
        <h1 className="m-0 font-display text-display-l font-extrabold tracking-display">
          {t("title")}
        </h1>
        {!inRoom && <PlayingAs band={band} locked={locked} onNotYou={clearAge} />}
      </div>
      <p className="m-0 text-[17px] leading-[1.5] text-text-muted">{t("lede")}</p>
      {inRoom && forRoom.data?.someHidden && (
        <p className="m-0 text-[14px] leading-[1.4] text-text-muted">{t("someHidden")}</p>
      )}
      {packs ? (
        <PackPicker
          packs={packs}
          questionsPerGame={questionsPerGame}
          band={band}
          initialPack={params.get("pack") ?? undefined}
          cta={(name) => t("continue", { pack: name })}
          busy={busy}
          onContinue={go}
          aboveCta={challenge}
          error={error}
        />
      ) : (
        <PickerSkeleton label={t("group")} bare />
      )}
      {element}
    </main>
  );
}

export function PickerSkeleton({ label, bare = false }: { label: string; bare?: boolean }) {
  const grid = (
    <SkeletonGroup label={label} className="grid-cols-2 gap-3 p-2 lg:grid-cols-3">
      <Skeleton className="col-span-full h-[230px] rounded-card" />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-[230px] rounded-card" />
      ))}
    </SkeletonGroup>
  );
  if (bare) return grid;
  return (
    <main className="mx-auto box-border flex w-full max-w-[880px] flex-1 flex-col gap-5 px-5 pt-4 pb-7">
      {grid}
    </main>
  );
}
