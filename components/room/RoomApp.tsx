"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RevealStage } from "@/components/game/RevealStage";
import { ErrorScreen, type ErrorVariant } from "@/components/site/ErrorScreen";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { ClientApiError } from "@/lib/api/client";
import type { RoomState, StatePlayer } from "@/lib/api/types";
import { useOffline } from "@/lib/realtime/useOffline";
import { useRoomChannel } from "@/lib/realtime/useRoomChannel";
import { useAnswerQueue } from "@/lib/room/answerQueue";
import { roomKey, useRoomActions, useRoomState } from "@/lib/room/useRoom";
import { GuessView } from "./GuessView";
import { LobbyView } from "./LobbyView";
import { PercentGuessView } from "./PercentGuessView";
import { QuestionView } from "./QuestionView";
import { RankView } from "./RankView";
import { RateView } from "./RateView";
import { VoteView } from "./VoteView";
import { ReadyView } from "./ReadyView";
import { ResultsView } from "./ResultsView";
import { RoomShell } from "./RoomShell";
import { RoomSkeleton } from "./RoomSkeleton";
import { WaitingView } from "./WaitingView";
import { track } from "@/lib/analytics/posthog";

type Screen = "lobby" | "question" | "waiting" | "guess" | "ready" | "reveal" | "results";

function screenFor(state: RoomState): Screen {
  switch (state.room.status) {
    case "lobby":
      return "lobby";
    case "answering":
      return state.me.answersSubmitted || state.me.status !== "active" ? "waiting" : "question";
    case "guessing":
      // Nothing to guess: the guess screen shows its own locked-in card (SPIL-01).
      return state.me.targets.length === 0 || !state.me.guessesSubmitted ? "guess" : "waiting";
    case "ready":
      return "ready";
    default: {
      // SPIL-11: the host paces the reveal; it is over when the server's slide passes the last.
      const r = state.room.reveal;
      return !r || r.index >= r.total ? "results" : "reveal";
    }
  }
}

function errorFor(error: unknown): ErrorVariant {
  if (!(error instanceof ClientApiError)) return "server";
  if (error.code === "OFFLINE") return "offline";
  if (error.code === "ROOM_EXPIRED") return "expired";
  if (error.code === "ROOM_NOT_FOUND") return "notfound";
  if (error.code === "NOT_IN_ROOM" && error.message === "REMOVED") return "removed";
  return error.status >= 500 ? "waking" : "notfound";
}

/** The whole in-room experience; the server decides the phase, this only renders it. */
export function RoomApp({ code }: { code: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const tt = useTranslations("toast");
  const ts = useTranslations("sheet");
  const c = useTranslations("common");
  const live = useRef(false);
  const query = useRoomState(code, live);
  const state = query.data;
  const actions = useRoomActions(code);
  const [leaving, setLeaving] = useState(false);
  const [shake, setShake] = useState(0);

  const onNudge = useCallback(
    (target: string) => {
      if (!state || target !== state.me.id) return;
      navigator.vibrate?.([30, 40, 30]);
      setShake((n) => n + 1);
      const host = state.players.find((p) => p.isHost);
      toast(tt("nudgedYou", { host: host?.nickname ?? "" }), "info");
    },
    [state, toast, tt],
  );

  const channel = useRoomChannel({
    code,
    channel: state?.room.channel,
    playerId: state?.me.id,
    pollingOnly: state?.room.pollingOnly ?? false,
    onNudge,
  });
  useEffect(() => {
    live.current = channel.live;
  }, [channel.live]);
  const roster = state?.players;
  const meId = state?.me.id;
  const humans = useMemo(
    () => (roster ?? []).filter((p) => !p.isBot && p.id !== meId).map((p) => p.id),
    [roster, meId],
  );
  const offline = useOffline(humans, channel.online, channel.live);
  const pending = useAnswerQueue((s) =>
    state ? s.pending[`${code}:${state.room.round}`] : undefined,
  );

  // Not a player here yet: the profile screen joins (lobby), otherwise show why.
  const error = query.error;
  useEffect(() => {
    if (
      error instanceof ClientApiError &&
      (error.code === "NOT_IN_ROOM" || error.code === "UNAUTHENTICATED") &&
      error.message !== "REMOVED"
    ) {
      router.replace(`/r/${code}/me`);
    }
  }, [error, code, router]);

  const fail = (e: unknown) => {
    const reason = e instanceof ClientApiError ? e.code : "";
    if (reason === "PACK_NOT_ALLOWED") return toast(tt("packNotAllowed"), "err");
    if (reason === "NOT_ENOUGH_PLAYERS")
      return toast(tt("needPlayersProd", { min: state?.room.settings.minPlayers ?? 2 }), "err");
    if (reason === "RATE_LIMITED") return toast(tt("rateLimited"), "err");
    if (reason === "WRONG_PHASE") return qc.invalidateQueries({ queryKey: roomKey(code) });
    toast(tt("somethingWrong"), "err");
  };

  if (
    error &&
    !(
      error instanceof ClientApiError &&
      (error.code === "NOT_IN_ROOM" || error.code === "UNAUTHENTICATED") &&
      error.message !== "REMOVED"
    )
  ) {
    return <ErrorScreen variant={errorFor(error)} onRetry={() => query.refetch()} />;
  }

  if (!state) {
    return (
      <div className="mx-auto box-border w-full max-w-[520px] px-5 pt-20">
        <RoomSkeleton />
      </div>
    );
  }

  const screen = screenFor(state);
  if (process.env.NODE_ENV !== "production" && screen === "reveal" && !state.results)
    console.error("RoomApp: the reveal screen has no results to show");

  if (screen === "reveal" && state.results) {
    return (
      <RevealStage
        rows={state.results.rows}
        awards={state.results.awards}
        exact={state.results.exact}
        percent={
          state.room.mode === "room_percentage" || state.room.mode === "hot_takes"
            ? state.results.percent
            : undefined
        }
        likely={state.room.mode === "most_likely" ? state.results.likely : undefined}
        flags={state.room.mode === "red_green" ? state.results.flags : undefined}
        ranked={state.room.mode === "rank_room" ? state.results.ranked : undefined}
        average={state.room.mode === "hot_takes"}
        reveal={state.room.reveal!}
        isHost={state.me.isHost}
        hostName={state.players.find((p) => p.isHost)?.nickname ?? ""}
        nexting={actions.revealNext.isPending}
        onNext={(expected) => actions.revealNext.mutate(expected, { onError: fail })}
        onSkip={() => actions.revealSkip.mutate(undefined, { onError: fail })}
      />
    );
  }

  const results = state.results?.rows ?? [];
  const hot = state.room.mode === "hot_takes";
  const likely = state.room.mode === "most_likely";
  const flags = state.room.mode === "red_green";
  const rank = state.room.mode === "rank_room";
  // Modes without a Spill Score show points for reading the room in the roster.
  const pointsOnly = hot || likely || flags || rank;
  const statusFor = (id: string) => {
    const p = state.players.find((x) => x.id === id);
    if (!p) return "";
    if (screen === "lobby") return p.isHost ? c("host") : p.isBot ? c("test") : "";
    if (screen === "ready") return c("locked");
    if (screen === "results") {
      const row = results.find((r) => r.playerId === id);
      // Hot Takes has no Spill Score: the roster shows points for reading the room.
      return String((pointsOnly ? row?.mindReader : row?.score) ?? "");
    }
    const done = state.room.status === "guessing" ? p.guessesSubmitted : p.answersSubmitted;
    if (done) return state.room.status === "guessing" ? c("locked") : c("done");
    if (state.room.status === "guessing") return c("guessing");
    // My own count comes from this phone, so it never waits for the server (SPIL-03).
    const answered =
      p.id === state.me.id && hot
        ? Object.keys(state.myRatings ?? {}).length
        : p.id === state.me.id && likely
          ? Object.keys(state.myVotes ?? {}).length
          : p.id === state.me.id && rank
            ? Object.keys(state.myRanks ?? {}).length
            : p.id === state.me.id
              ? new Set([...Object.keys(state.myAnswers ?? {}), ...Object.keys(pending ?? {})]).size
              : p.answered;
    return `${answered}/${state.room.questionCount}`;
  };

  const leaveCopy = state.me.isHost
    ? state.players.some((p) => !p.isBot && p.id !== state.me.id && p.status === "active")
      ? ts("leaveHostNext")
      : ts("leaveHostOnly")
    : state.room.status !== "lobby"
      ? ts("leaveInGame")
      : ts("leaveLobby");

  const skip = () => {
    track("reveal_skipped", {});
    actions.skipToReveal.mutate(undefined, { onError: fail });
  };

  const leave = async () => {
    try {
      await actions.leave.mutateAsync(undefined);
    } catch {
      // leaving locally is enough to move on
    }
    qc.removeQueries({ queryKey: roomKey(code) });
    toast(tt("leftRoom"));
    router.replace("/");
  };

  return (
    <div key={shake} className={shake ? "animate-shake" : undefined}>
      <RoomShell
        state={state}
        online={channel.online}
        offline={offline}
        statusFor={statusFor}
        order={screen === "results" ? results.map((r) => r.playerId) : undefined}
        onLeave={() => setLeaving(true)}
      >
        {screen === "lobby" && (
          <LobbyView
            state={state}
            starting={actions.start.isPending}
            onStart={() =>
              actions.start.mutate(undefined, {
                onError: fail,
                onSuccess: (s) =>
                  track("game_started", {
                    pack: s.room.pack.id,
                    players: s.players.length,
                    questionCount: s.room.questionCount,
                  }),
              })
            }
            onKick={(id, name) =>
              actions.kick.mutate(id, {
                onSuccess: () => toast(tt("removed", { name })),
                onError: fail,
              })
            }
            onAddTest={() => actions.addTestPlayers.mutate(1, { onError: fail })}
          />
        )}
        {screen === "question" && hot && (
          <RateView
            key={state.room.round}
            state={state}
            onDone={() => actions.submitAnswers.mutateAsync(undefined).catch(fail)}
          />
        )}
        {screen === "question" && likely && (
          <VoteView
            key={state.room.round}
            state={state}
            onDone={() => actions.submitAnswers.mutateAsync(undefined).catch(fail)}
          />
        )}
        {screen === "question" && rank && (
          <RankView
            key={state.room.round}
            state={state}
            onDone={() => actions.submitAnswers.mutateAsync(undefined).catch(fail)}
          />
        )}
        {screen === "question" && !hot && !likely && !rank && (
          <QuestionView
            key={state.room.round}
            state={state}
            flags={flags}
            onDone={() => actions.submitAnswers.mutateAsync(undefined).catch(fail)}
          />
        )}
        {screen === "waiting" && (
          <WaitingView
            state={state}
            offline={offline}
            skipping={actions.skipToReveal.isPending}
            onSkip={skip}
            forcing={actions.advance.isPending}
            onForce={() => {
              const from = state.room.status === "guessing" ? "guessing" : "answering";
              track("phase_forced", { from });
              actions.advance.mutate(from, { onError: fail });
            }}
            onNudge={(players: StatePlayer[]) => {
              for (const p of players) actions.nudge.mutate(p.id, { onError: fail });
              toast(tt("nudged", { names: players.map((p) => p.nickname).join(" and ") }));
            }}
          />
        )}
        {screen === "guess" && (state.room.mode === "room_percentage" || hot) && (
          <PercentGuessView
            key={state.room.round}
            state={state}
            average={hot}
            skipping={actions.skipToReveal.isPending}
            onSkip={skip}
            onDone={() => actions.submitGuesses.mutateAsync(undefined).catch(fail)}
          />
        )}
        {screen === "guess" && state.room.mode === "classic" && (
          <GuessView
            key={state.room.round}
            state={state}
            skipping={actions.skipToReveal.isPending}
            onSkip={skip}
            onDone={() => actions.submitGuesses.mutateAsync(undefined).catch(fail)}
          />
        )}
        {screen === "ready" && (
          <ReadyView
            state={state}
            revealing={actions.advance.isPending}
            onReveal={() => {
              track("room_revealed", { players: state.players.length });
              actions.advance.mutate("ready", { onError: fail });
            }}
          />
        )}
        {screen === "results" && (
          <ResultsView
            state={state}
            onSpill={(on) => {
              track("spill_mode_toggled", { on });
              actions.patchMe.mutate({ spillMode: on }, { onError: fail });
            }}
            onHideName={(hide) =>
              actions.patchMe.mutate({ hideNameOnCard: hide }, { onError: fail })
            }
          />
        )}
      </RoomShell>

      <Sheet
        open={leaving}
        onOpenChange={setLeaving}
        title={ts("leaveTitle")}
        description={leaveCopy}
      >
        <Button variant="destructive" loading={actions.leave.isPending} onClick={leave}>
          {c("leaveRoom")}
        </Button>
        <Button variant="secondary" onClick={() => setLeaving(false)}>
          {c("stay")}
        </Button>
      </Sheet>
    </div>
  );
}
