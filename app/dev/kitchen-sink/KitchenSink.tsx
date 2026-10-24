"use client";

import { CheckIcon, XIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Avatar } from "@/components/brand/Avatar";
import { PourProgress } from "@/components/brand/PourProgress";
import {
  AWARD_ORDER,
  AwardBadge,
  AwardSticker,
  LabelSticker,
  type LabelName,
} from "@/components/brand/Stickers";
import { labelFor } from "@/lib/game";
import { Vessel } from "@/components/brand/Vessel";
import { Wordmark } from "@/components/brand/Wordmark";
import { Button } from "@/components/ui/Button";
import { CodeInput } from "@/components/ui/CodeInput";
import { IconButton } from "@/components/ui/IconButton";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { SwitchRow } from "@/components/ui/Switch";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-line pt-6">
      <h2 className="m-0 font-mono text-caption tracking-[.08em] text-accent-ink uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function KitchenSink() {
  const toast = useToast();
  const [code, setCode] = useState("K7");
  const [on, setOn] = useState(true);
  const [tab, setTab] = useState<"scores" | "awards" | "questions">("scores");
  const [sheet, setSheet] = useState(false);
  const [level, setLevel] = useState(64);
  const [q, setQ] = useState(4);

  return (
    <main className="mx-auto grid max-w-[880px] gap-10 px-5 py-12">
      <header className="flex items-center justify-between gap-4">
        <Wordmark size={44} />
      </header>

      <Section title="Type">
        <h1 className="m-0 font-display text-display-l font-extrabold tracking-display">
          Pick your poison.{" "}
          <span className="text-accent-ink" style={{ fontStretch: "75%" }}>
            Lights down.
          </span>
        </h1>
        <p className="m-0 text-body-l text-text-muted">
          Answer “Have you ever…” questions in private.
        </p>
        <span className="font-mono text-[76px] leading-none font-semibold tracking-[.06em]">
          K7QX
        </span>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-2.5">
          <Button>Start a game</Button>
          <Button variant="secondary">Join with code</Button>
          <Button variant="ghost" size="md">
            Paste code
          </Button>
          <Button variant="destructive">Leave room</Button>
          <Button softDisabled>Start the game</Button>
          <Button loading>Saving</Button>
          <IconButton label="Close">
            <XIcon aria-hidden />
          </IconButton>
        </div>
        <div className="flex gap-2.5">
          <button
            type="button"
            className="flex h-16 flex-1 items-center justify-center gap-2 rounded-pill border-[1.5px] border-text bg-transparent text-[18px] font-bold text-text active:scale-[.97]"
          >
            <XIcon size={22} aria-hidden />
            No
          </button>
          <button
            type="button"
            className="flex h-16 flex-1 items-center justify-center gap-2 rounded-pill border-[1.5px] border-accent bg-accent text-[18px] font-bold text-on-accent active:scale-[.97]"
          >
            <CheckIcon size={22} aria-hidden />
            Yes
          </button>
        </div>
      </Section>

      <Section title="Inputs">
        <CodeInput id="ks-code" value={code} onChange={setCode} />
        <TextField
          id="ks-nick"
          label="Nickname"
          placeholder="Your name in this room"
          help="2 to 16 characters. Everyone in the room sees this."
        />
        <TextField
          id="ks-nick-err"
          label="Nickname"
          defaultValue="A"
          error="Pick a nickname with 2 to 16 characters."
        />
        <SwitchRow
          checked={on}
          onCheckedChange={setOn}
          title="Spill Mode"
          description={
            on
              ? "On. This room can see your yes and no answers."
              : "Off. Show your yes and no answers to this room only."
          }
        />
        <SwitchRow
          checked={!on}
          onCheckedChange={(v) => setOn(!v)}
          title="Hide my name"
          look="plain"
        />
      </Section>

      <Section title="Tabs and sheet">
        <SegmentedTabs
          label="Results"
          value={tab}
          onValueChange={setTab}
          items={[
            { value: "scores", label: "Scores" },
            { value: "awards", label: "Awards" },
            { value: "questions", label: "Questions" },
          ]}
        />
        <div className="flex gap-2.5">
          <Button variant="secondary" onClick={() => setSheet(true)}>
            Open sheet
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast("Link copied. Drop it in the group chat.")}
          >
            Toast
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast("This room is full. 12 players max.", "err")}
          >
            Error toast
          </Button>
        </div>
        <Sheet
          open={sheet}
          onOpenChange={setSheet}
          title="Leave this room?"
          description="You can join again with the code while the lobby is open."
        >
          <Button variant="destructive" onClick={() => setSheet(false)}>
            Leave room
          </Button>
          <Button variant="secondary" onClick={() => setSheet(false)}>
            Stay
          </Button>
        </Sheet>
      </Section>

      <Section title="Avatars">
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
          {Array.from({ length: 24 }, (_, n) => (
            <Avatar key={n} n={n} size={48} selected={n === 16} />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Avatar n={3} size={32} />
          <Avatar n={3} size={48} />
          <Avatar n={3} size={72} />
          <Avatar n={3} size={112} />
        </div>
      </Section>

      <Section title="Stickers">
        <div className="flex flex-wrap gap-4 p-2">
          {[9, 30, 50, 64, 88].map((s, i) => (
            <LabelSticker
              key={s}
              label={labelFor(s).name as LabelName}
              rotate={[-4, 3, -2, 2, -3][i]}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-4 p-2">
          {AWARD_ORDER.map((a, i) => (
            <AwardBadge key={a} award={a} index={i} />
          ))}
        </div>
        <AwardSticker award="top_spiller" index={0} />
      </Section>

      <Section title="Liquid (one per screen in the app)">
        <input
          type="range"
          min={0}
          max={100}
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
          aria-label="Vessel level"
        />
        <Vessel
          level={level}
          num={level}
          height={250}
          fontSize={104}
          transition="transform 180ms var(--ease-out)"
        />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="md" onClick={() => setQ((v) => Math.max(0, v - 1))}>
            Back
          </Button>
          <PourProgress value={q} total={12} label="Questions answered" />
          <Button variant="ghost" size="md" onClick={() => setQ((v) => Math.min(12, v + 1))}>
            Next
          </Button>
        </div>
      </Section>

      <Section title="Skeleton">
        <SkeletonGroup label="Loading room" className="gap-4">
          <Skeleton className="h-3 w-[90px] rounded-pill" />
          <Skeleton className="h-[72px] w-[240px] rounded-input" />
          <div className="flex flex-wrap gap-x-2.5 gap-y-3.5">
            <Skeleton
              className="h-[52px] w-[120px] rounded-pill"
              style={{ transform: "rotate(-3deg)" }}
            />
            <Skeleton
              className="h-[52px] w-[104px] rounded-pill"
              style={{ transform: "rotate(2deg)" }}
            />
          </div>
        </SkeletonGroup>
      </Section>
    </main>
  );
}
