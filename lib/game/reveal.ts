/**
 * The host-paced reveal (SPIL-11) as pure data. The server keeps one number, the slide every
 * phone shows, and when that slide began; each phone works out the step within the slide from
 * the elapsed time, so all phones stay in step. One slide per tie group (SPIL-04), lowest score
 * first, then one per award. The slide count means the reveal is over.
 */
export type RevealSlide =
  | { kind: "group"; group: number; last: boolean }
  | { kind: "question"; question: number }
  | { kind: "award"; award: number };

/** Slides for a round: tie groups (classic) or scored questions (Room Percentage), then awards. */
export function revealSlides(
  groups: number,
  awards: number,
  by: "group" | "question" = "group",
): RevealSlide[] {
  return [
    ...Array.from({ length: groups }, (_, g) =>
      by === "question"
        ? { kind: "question" as const, question: g }
        : { kind: "group" as const, group: g, last: g === groups - 1 },
    ),
    ...Array.from({ length: awards }, (_, a) => ({ kind: "award" as const, award: a })),
  ];
}

/** Step lengths in ms (spec SPIL-11 table). */
export const REVEAL_MS = {
  /** "And the biggest spill of the night…" before the last group, when there is more than one. */
  topBeat: 1500,
  intro: 800,
  guess: 1200,
  fill: 1600,
  /** Stamp to verdict. */
  stamp: 400,
  /** Verdict on screen before Next unlocks: long enough to read it. */
  verdict: 1200,
  /** Award sticker beat, then its hold before Next unlocks. */
  awardBeat: 550,
  awardHold: 950,
  /** With Auto on, the host's phone moves on this long after Next unlocks. */
  auto: 2500,
} as const;

export type GroupStep = "beat" | "intro" | "guess" | "fill" | "stamp" | "verdict";

/** Whether the top-spiller beat runs before this slide. */
export function hasTopBeat(slide: RevealSlide, groups: number): boolean {
  return slide.kind === "group" && slide.last && groups > 1;
}

/**
 * Step of a question slide (Room Percentage): the question (intro), the room's real share
 * filling the vessel, then everyone's guesses with their points (stamp, verdict).
 */
export function questionStep(t: number): { step: GroupStep; fill: number } {
  let at = Math.max(0, t);
  if (at < REVEAL_MS.intro) return { step: "intro", fill: 0 };
  at -= REVEAL_MS.intro;
  if (at < REVEAL_MS.fill) return { step: "fill", fill: at / REVEAL_MS.fill };
  at -= REVEAL_MS.fill;
  if (at < REVEAL_MS.stamp) return { step: "stamp", fill: 1 };
  return { step: "verdict", fill: 1 };
}

/** Step of a group slide `t` ms after it began; `fill` is 0 to 1 through the fill step. */
export function groupStep(
  t: number,
  topBeat: boolean,
): { step: GroupStep; fill: number; sinceStep: number } {
  let at = Math.max(0, t);
  if (topBeat) {
    if (at < REVEAL_MS.topBeat) return { step: "beat", fill: 0, sinceStep: at };
    at -= REVEAL_MS.topBeat;
  }
  if (at < REVEAL_MS.intro) return { step: "intro", fill: 0, sinceStep: at };
  at -= REVEAL_MS.intro;
  if (at < REVEAL_MS.guess) return { step: "guess", fill: 0, sinceStep: at };
  at -= REVEAL_MS.guess;
  if (at < REVEAL_MS.fill) return { step: "fill", fill: at / REVEAL_MS.fill, sinceStep: at };
  at -= REVEAL_MS.fill;
  if (at < REVEAL_MS.stamp) return { step: "stamp", fill: 1, sinceStep: at };
  return { step: "verdict", fill: 1, sinceStep: at - REVEAL_MS.stamp };
}

/** How long a slide runs before the host may move on; the server enforces it too. */
export function slideMinMs(slide: RevealSlide, groups: number): number {
  if (slide.kind === "award") return REVEAL_MS.awardBeat + REVEAL_MS.awardHold;
  if (slide.kind === "question")
    return REVEAL_MS.intro + REVEAL_MS.fill + REVEAL_MS.stamp + REVEAL_MS.verdict;
  return (
    (hasTopBeat(slide, groups) ? REVEAL_MS.topBeat : 0) +
    REVEAL_MS.intro +
    REVEAL_MS.guess +
    REVEAL_MS.fill +
    REVEAL_MS.stamp +
    REVEAL_MS.verdict
  );
}

export type NextCheck = "ok" | "stale" | "done" | "too_early";

/**
 * May the host move from `expected` on? Stale (a double tap or an old screen) and finished
 * reveals are ignored without error; too early is refused.
 */
export function checkRevealNext(input: {
  index: number;
  expected: number;
  slides: readonly RevealSlide[];
  groups: number;
  elapsedMs: number;
}): NextCheck {
  const { index, expected, slides, groups, elapsedMs } = input;
  if (index >= slides.length) return "done";
  if (expected !== index) return "stale";
  return elapsedMs >= slideMinMs(slides[index]!, groups) ? "ok" : "too_early";
}
