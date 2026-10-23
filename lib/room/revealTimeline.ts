/**
 * The reveal ceremony as a pure function of elapsed time (HANDOFF beats). Every client computes
 * the same frame from the server's revealed_at, so phones in one room stay in step.
 */
export const BEATS = {
  intro: 700,
  count: 1400,
  toLabel: 150,
  hold: 1200,
  gap: 450,
  awardBeat: 550,
  awardHold: 1900,
} as const;

export type RevealFrame =
  | { phase: "intro"; player: number; count: number }
  | { phase: "count"; player: number; count: number }
  | { phase: "label"; player: number; count: number }
  | { phase: "beat"; award: number }
  | { phase: "award"; award: number }
  | { phase: "done" };

const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);

export function revealDuration(players: number, awards: number) {
  if (players === 0) return 0;
  const perPlayer = BEATS.count + BEATS.toLabel + BEATS.hold;
  return (
    BEATS.intro +
    players * perPlayer +
    (players - 1) * BEATS.gap +
    awards * (BEATS.awardBeat + BEATS.awardHold)
  );
}

/**
 * Frame at `t` ms. `scores` are in reveal order (ascending). With `reduced`, the count jumps
 * straight to the final score but every beat keeps its length (they carry order).
 */
export function frameAt(
  t: number,
  scores: readonly number[],
  awards: number,
  reduced = false,
): RevealFrame {
  if (scores.length === 0) return { phase: "done" };
  let at = t;
  for (let i = 0; i < scores.length; i++) {
    const lead = i === 0 ? BEATS.intro : BEATS.gap;
    if (at < lead) return { phase: "intro", player: i, count: 0 };
    at -= lead;
    const target = scores[i]!;
    if (at < BEATS.count) {
      const count = reduced ? target : Math.round(target * easeOutCubic(at / BEATS.count));
      return { phase: "count", player: i, count };
    }
    at -= BEATS.count;
    if (at < BEATS.toLabel) return { phase: "count", player: i, count: target };
    at -= BEATS.toLabel;
    if (at < BEATS.hold) return { phase: "label", player: i, count: target };
    at -= BEATS.hold;
  }
  for (let a = 0; a < awards; a++) {
    if (at < BEATS.awardBeat) return { phase: "beat", award: a };
    at -= BEATS.awardBeat;
    if (at < BEATS.awardHold) return { phase: "award", award: a };
    at -= BEATS.awardHold;
  }
  return { phase: "done" };
}
