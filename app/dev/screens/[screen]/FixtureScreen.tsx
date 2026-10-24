"use client";

import { useSearchParams } from "next/navigation";
import { RevealStage } from "@/components/game/RevealStage";
import { ErrorScreen, type ErrorVariant } from "@/components/site/ErrorScreen";
import { GuessView } from "@/components/room/GuessView";
import { LobbyView } from "@/components/room/LobbyView";
import { QuestionView } from "@/components/room/QuestionView";
import { ReadyView } from "@/components/room/ReadyView";
import { ResultsView } from "@/components/room/ResultsView";
import { RoomShell } from "@/components/room/RoomShell";
import { RoomSkeleton } from "@/components/room/RoomSkeleton";
import { WaitingView } from "@/components/room/WaitingView";
import { SiteHeader } from "@/components/site/SiteHeader";
import { fixtureState } from "@/lib/dev/fixtures";

const noop = () => {};
const done = () => Promise.resolve();

// Reveal freeze points (ms) matching the design frames: Ama counting at 47, Ama's label, award 1.
// SPIL-11 slides held at a moment: [slide index, ms into the slide]. "tie": Ama and Kofi both on
// 72 (SPIL-04), slide 4 of the tie variant.
const FREEZE = {
  guess: [0, 1500],
  count: [0, 2800],
  label: [0, 4300],
  beat: [6, 600],
  award: [7, 1200],
  tie: [4, 4300],
} as const;

export function FixtureScreen({ screen }: { screen: string }) {
  const variant = useSearchParams().get("variant") ?? "";
  const status = {
    lobby: "lobby",
    question: "answering",
    waiting: "answering",
    guess: "guessing",
    ready: "ready",
    reveal: "revealed",
    results: "revealed",
  }[screen];

  if (screen === "error") {
    return (
      <div className="flex min-h-[100dvh] flex-col">
        <SiteHeader back="/" />
        <ErrorScreen variant={(variant || "notfound") as ErrorVariant} />
      </div>
    );
  }
  if (!status) return <p className="p-5">Unknown screen</p>;

  const guest = variant === "guest";
  const players = screen === "lobby" ? (variant === "empty" ? 1 : variant === "few" ? 2 : 7) : 7;
  const state = fixtureState({ status: status as never, players, host: !guest });
  if (guest) {
    state.me.nickname = "Zainab";
    state.me.avatar = 9;
  }
  if (screen === "waiting") state.me.answersSubmitted = true;
  if (variant === "tie" && state.results) {
    const ama = state.results.rows.find((r) => r.playerId === "ama")!;
    state.results.rows = state.results.rows.map((r) =>
      r.playerId === "kofi"
        ? { ...r, score: ama.score, label: ama.label, mindReader: ama.mindReader }
        : r,
    );
  }
  if (screen === "guess" && variant === "nothing") {
    state.me.targets = [];
    state.me.guessesSubmitted = true;
  }

  if (screen === "reveal" && state.results) {
    return (
      <RevealStage
        rows={state.results.rows}
        awards={state.results.awards}
        exact={state.results.exact}
        reveal={{
          index: (FREEZE[(variant || "count") as keyof typeof FREEZE] ?? FREEZE.count)[0],
          at: new Date(0).toISOString(),
        }}
        isHost={!guest}
        hostName="Ama"
        onNext={noop}
        onSkip={noop}
        freezeAt={(FREEZE[(variant || "count") as keyof typeof FREEZE] ?? FREEZE.count)[1]}
      />
    );
  }

  const statusFor = (id: string) => {
    const p = state.players.find((x) => x.id === id);
    if (!p) return "";
    if (screen === "lobby") return p.isHost ? "Host" : "";
    if (screen === "ready") return "Locked";
    if (screen === "results")
      return String(state.results?.rows.find((r) => r.playerId === id)?.score ?? "");
    return p.answersSubmitted ? "Done" : `${p.answered}/${state.room.questionCount}`;
  };

  return (
    <RoomShell
      state={state}
      online={new Set(state.players.map((p) => p.id))}
      statusFor={statusFor}
      order={screen === "results" ? state.results?.rows.map((r) => r.playerId) : undefined}
      onLeave={noop}
    >
      {screen === "lobby" &&
        (variant === "loading" ? (
          <RoomSkeleton />
        ) : (
          <LobbyView state={state} starting={false} onStart={noop} onKick={noop} onAddTest={noop} />
        ))}
      {screen === "question" && (
        <QuestionView
          state={state}
          onDone={done}
          preview={{
            dragX: variant === "swipe" ? 78 : undefined,
            saving: variant === "saving" ? true : undefined,
            offline: variant === "offline" ? true : undefined,
          }}
        />
      )}
      {screen === "waiting" && (
        <WaitingView
          state={state}
          onNudge={noop}
          onForce={noop}
          forcing={false}
          onSkip={noop}
          skipping={false}
          initialSheet={variant === "sheet"}
        />
      )}
      {screen === "guess" && (
        <GuessView
          state={state}
          onDone={done}
          onSkip={noop}
          skipping={false}
          initialValue={variant === "empty" ? null : 64}
        />
      )}
      {screen === "ready" && <ReadyView state={state} onReveal={noop} revealing={false} />}
      {screen === "results" && (
        <ResultsView
          state={{ ...state, me: { ...state.me, spillMode: variant === "questions" } }}
          onSpill={noop}
          onHideName={noop}
          initialTab={
            variant === "awards" ? "awards" : variant === "questions" ? "questions" : "scores"
          }
          initialShare={variant === "share"}
        />
      )}
    </RoomShell>
  );
}
