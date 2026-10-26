"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { AgeGate, PlayingAs } from "@/components/age/AgeGate";
import { GameStep, type PlayAgain } from "@/components/game/GameStep";
import { PackPicker } from "@/components/game/PackPicker";
import { ErrorScreen } from "@/components/site/ErrorScreen";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { SwitchRow } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { useTurnstile } from "@/components/ui/Turnstile";
import { playableBand, useDeviceAge } from "@/lib/age/device";
import { api, ClientApiError, ensureSession } from "@/lib/api/client";
import type { Pack } from "@/lib/api/types";
import { track } from "@/lib/analytics/posthog";
import {
  bandFloor,
  defaultCount,
  FEATURED_MODE,
  isMode,
  packsForMode,
  parseSetupMode,
  STORY_VOTE_MODE,
  withStoryVote,
  type Mode,
  type SetupPath,
} from "@/lib/game";
import { readLastGame, saveLastGame } from "@/lib/setup/lastGame";
import { useBusy } from "@/lib/useBusy";

type Props = {
  /** The 13+ packs, rendered on the server; safe for every band. */
  packs: Pack[];
  questionsPerGame: number;
  ageLockHours: number;
};

/**
 * Host flow: age first (SPIL-02), then game setup in two steps (owner request 2026-10-26): pick
 * a game, which starts straight away when it has one pack, or pick a pack and length next. The
 * room is created and the host sets up their profile. With ?room=CODE&mode=pack|rematch the same
 * steps change an existing room's game and pack, limited to what its youngest player may play.
 * The pack step lives at ?game=<mode>, so Back returns to the games.
 */
export function CreateRoom({ packs: everyone, questionsPerGame, ageLockHours }: Props) {
  const t = useTranslations("packs");
  const ts = useTranslations("setup");
  const tm = useTranslations("modes");
  const tt = useTranslations("toast");
  const toast = useToast();
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const room = params.get("room");
  const flow = params.get("mode");
  const inRoom = Boolean(room && (flow === "pack" || flow === "rematch"));
  const current =
    inRoom && isMode(params.get("current")) ? (params.get("current") as Mode) : undefined;
  const { getToken, element, challenge, showChallenge } = useTurnstile();
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<Mode | null>(null);
  const [busy, setBusy] = useBusy();
  const [last] = useState(() => (inRoom ? null : readLastGame()));
  const { band: stored, locked, setAge, clearAge } = useDeviceAge();
  const band = playableBand(stored);
  const hostFloor = band ? bandFloor(band) : 13;

  // Older bands may see more than the 13+ packs the page rendered with.
  const forBand = useQuery({
    queryKey: ["packs", hostFloor],
    queryFn: () => api<Pack[]>("GET", `/packs?band=${band}`),
    enabled: !inRoom && hostFloor > 13,
  });
  // In a room the server decides from its youngest player and never names them.
  const forRoom = useQuery({
    queryKey: ["room-packs", room, "all"],
    queryFn: () => api<{ packs: Pack[]; someHidden: boolean }>("GET", `/rooms/${room}/packs?all=1`),
    enabled: inRoom,
  });
  const packs = inRoom ? forRoom.data?.packs : hostFloor > 13 ? forBand.data : everyone;
  // In a room, the packs it may play say how old its youngest player is (never who).
  const floor = inRoom ? Math.max(13, ...(packs ?? []).map((p) => p.minAge)) : hostFloor;
  const game = parseSetupMode(params.get("game"), floor);

  const withParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    return `${path}?${next.toString()}`;
  };

  /** Every failure ends with a message: inline under Continue and as a toast (SPIL-05). */
  const failWith = (message: string) => {
    setError(message);
    toast(message, "err");
    setBusy(false);
    setStarting(null);
  };

  const go = async (mode: Mode, packId: string, questionCount: number) => {
    if (!band) return;
    setError(null);
    setBusy(true);
    try {
      if (inRoom) {
        if (flow === "rematch")
          track("rematch_started", { packChanged: packId !== params.get("pack") });
        if (flow === "pack")
          await api("PATCH", `/rooms/${room}/pack`, { packId, questionCount, mode });
        else await api("POST", `/rooms/${room}/rematch`, { packId, questionCount, mode });
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
        mode,
        crewId: params.get("crew") ?? undefined,
        packId,
        questionCount,
        captchaToken: captchaToken || undefined,
      });
      saveLastGame({ mode, packId, count: questionCount });
      track("room_created", { pack: packId, questionCount, mode });
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
                  : code === "MODE_UNAVAILABLE"
                    ? tt("modeUnavailable")
                    : code === "PACK_PREMIUM"
                      ? tt("packPremium")
                      : tt("somethingWrong"),
      );
    }
  };

  /** One-tap games start straight away with the default length; others open the pack step. */
  const pick = (mode: Mode, next: SetupPath) => {
    if (next.kind === "choose") return router.push(withParams({ game: mode }), { scroll: true });
    if (next.kind !== "start") return;
    const pack = packs?.find((p) => p.id === next.packId);
    setStarting(mode);
    void go(mode, next.packId, defaultCount(pack?.questionCount ?? 0, questionsPerGame));
  };

  if (stored === undefined) return <PickerSkeleton label={t("group")} />;
  if (stored === "under_13") return <ErrorScreen variant="tooYoung" />;
  if (!band) return <AgeGate who="host" onAge={(years) => setAge(years, ageLockHours)} />;

  // "Play again" only when that game and pack can still be played here.
  const again = last && packs?.find((p) => p.id === last.packId && !p.locked);
  const playAgain: PlayAgain | null =
    last && again && parseSetupMode(last.mode, floor) && packsForMode([again], last.mode).length
      ? { ...last, packName: again.name }
      : null;

  const withCheck = (step: ReactNode) => (
    <>
      {step}
      {element}
    </>
  );

  const hidden = inRoom && forRoom.data?.someHidden && (
    <p className="m-0 text-[14px] leading-[1.4] text-text-muted">{t("someHidden")}</p>
  );

  // The invisible bot check stays mounted in one place across both steps: moving its holder
  // would strand the widget in a detached node and Continue would never get a token.
  if (!game)
    return withCheck(
      <main className="mx-auto box-border flex w-full max-w-[880px] flex-1 flex-col gap-5 px-5 pt-4 pb-10">
        <div className="grid gap-2.5">
          <h1 className="m-0 font-display text-display-l font-extrabold tracking-display">
            {inRoom ? ts("titleRoom") : ts("title")}
          </h1>
          {!inRoom && <PlayingAs band={band} locked={locked} onNotYou={clearAge} />}
        </div>
        <p className="m-0 text-[17px] leading-[1.5] text-pretty text-text-muted">{ts("lede")}</p>
        {hidden}
        {packs ? (
          <GameStep
            packs={packs}
            floor={floor}
            starting={starting}
            current={current}
            playAgain={playAgain}
            onPick={pick}
            onPlayAgain={(g) => {
              setStarting(g.mode);
              void go(g.mode, g.packId, g.count);
            }}
          />
        ) : (
          <GamesSkeleton label={ts("title")} />
        )}
        {error && (
          <p role="alert" className="m-0 text-[15px] leading-[1.4] font-medium text-error">
            {error}
          </p>
        )}
        {challenge}
      </main>,
    );

  const fit = packsForMode(packs ?? [], game);
  const storyVote = game === FEATURED_MODE || game === STORY_VOTE_MODE;
  const initialPack = params.get("pack") ?? undefined;
  return withCheck(
    <main className="mx-auto box-border flex w-full max-w-[880px] flex-1 flex-col gap-5 px-5 pt-4">
      <div className="grid gap-3">
        <h1 className="m-0 font-display text-display-l font-extrabold tracking-display">
          {t("title")}
        </h1>
        <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] leading-[1.4]">
          <span className="text-text-muted">{ts("gameLine")}</span>
          <span className="font-semibold">{tm(`${game}.name`)}</span>
          <span aria-hidden className="text-text-muted">
            ·
          </span>
          <button
            type="button"
            onClick={() => router.push(withParams({ game: null }), { scroll: true })}
            className="border-0 bg-transparent p-0 text-[15px] leading-[1.4] font-semibold text-accent-ink underline underline-offset-4 hover:text-text"
          >
            {ts("changeGame")}
          </button>
        </p>
      </div>
      {storyVote && (
        <SwitchRow
          checked={game === STORY_VOTE_MODE}
          onCheckedChange={(on) =>
            router.replace(withParams({ game: withStoryVote(game, on) }), { scroll: false })
          }
          title={ts("storyVote")}
          description={ts("storyVoteBody")}
        />
      )}
      {hidden}
      {packs ? (
        <PackPicker
          key={inRoom ? "room" : game}
          packs={fit}
          questionsPerGame={questionsPerGame}
          band={band}
          initialPack={fit.some((p) => p.id === initialPack) ? initialPack : undefined}
          cta={(name) => t("continue", { pack: name })}
          busy={busy}
          onContinue={(packId, count) => go(game, packId, count)}
          aboveCta={challenge}
          error={error}
        />
      ) : (
        <PickerSkeleton label={t("group")} bare />
      )}
    </main>,
  );
}

function GamesSkeleton({ label }: { label: string }) {
  return (
    <SkeletonGroup label={label} className="gap-3">
      <Skeleton className="h-[150px] rounded-card" />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-[110px] rounded-card" />
      ))}
    </SkeletonGroup>
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
