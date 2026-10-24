import { pickAwards, type AwardCandidate, type AwardResult } from "./awards";
import { labelFor, type LabelId } from "./labels";
import { scoreForRound } from "./scoring";
import { toMs, toMsOrNull, type AnswerValue, type PlayerStatus, type TimeInput } from "./types";

/**
 * Mind Reader points for one guess (SPIL-09): banded, so a lazy 50 earns nothing and the
 * scale reads at a glance. Exact 10, within 5 is 7, within 10 is 5, within 20 is 2, else 0.
 */
export function mindReaderPoints(diff: number): number {
  const d = Math.abs(diff);
  if (d === 0) return 10;
  if (d <= 5) return 7;
  if (d <= 10) return 5;
  if (d <= 20) return 2;
  return 0;
}

/** Closest guess about a target gets +3, only when this many people guessed it (fair at 2). */
export const CLOSEST_BONUS = 3;
export const MIN_GUESSERS_FOR_BONUS = 3;

/**
 * How well the room read someone (SPIL-09 thresholds), for result and reveal verdicts and the
 * landing demo: within 5 is "well", within 15 "a little", else "none".
 */
export function verdictBand(diff: number): "well" | "little" | "none" {
  const d = Math.abs(diff);
  return d <= 5 ? "well" : d <= 15 ? "little" : "none";
}

/** One scored guess, kept on the guess row so a finished round never changes. */
export interface GuessPoints {
  guesserId: string;
  targetId: string;
  points: number;
  closest: boolean;
}

/** Yes counts for a question are only shown when this many players answered it. */
export const MIN_ANSWERS_FOR_STATS = 3;

export interface ResultsQuestion {
  id: string;
  text: string;
}

export interface ResultsPlayer {
  id: string;
  nickname: string;
  status: PlayerStatus;
  joinedAt: TimeInput;
  answersSubmittedAt: TimeInput | null;
  guessesSubmittedAt: TimeInput | null;
  spillMode: boolean;
  /** This round's answers, by question id. */
  answers: Readonly<Record<string, AnswerValue | undefined>>;
  /** This round's guesses, by target player id. Values 0 to 100. */
  guesses: Readonly<Record<string, number | undefined>>;
}

export interface ResultsInput {
  /** The round's questions in draw order. */
  questions: readonly ResultsQuestion[];
  players: readonly ResultsPlayer[];
  /** Override for the 3+ answers privacy rule. Production leaves this at the default. */
  minAnswersForStats?: number;
}

export interface ResultRow {
  playerId: string;
  nickname: string;
  score: number;
  label: LabelId;
  /** Rounded mean of the others' guesses about this player; equals score when nobody guessed. */
  avgGuessAbout: number;
  /** Mind Reader points: banded points for every guess plus closest bonuses (SPIL-09). */
  mindReader: number;
  /** Exact guesses this player made. */
  bullseyes: number;
  /**
   * 1-based, by guessing (Mind Reader points) descending; players who made no guesses come
   * last. Ties share a rank (1, 1, 3). Rank 1 wins the round.
   */
  rank: number;
  spillMode: boolean;
}

export interface QuestionStat {
  questionId: string;
  text: string;
  /** Null when fewer than MIN_ANSWERS_FOR_STATS answered: a count would expose someone. */
  yes: number | null;
  answered: number;
  /** Nicknames of players with Spill Mode on who said yes. */
  spillNames: string[];
}

/**
 * Orders result rows for display: best guesser first (Mind Reader points), Spill Score breaking
 * ties, equal points sharing a rank (1, 1, 3). Applied on read so rooms finished before the
 * ranking changed (when rows were ranked by Spill Score) show the right winner too.
 */
export function rankByGuessing<T extends { mindReader: number; score: number }>(
  rows: readonly T[],
): Array<T & { rank: number }> {
  const sorted = [...rows].sort((a, b) => b.mindReader - a.mindReader || b.score - a.score);
  return sorted.map((r) => ({
    ...r,
    rank: 1 + sorted.filter((o) => o.mindReader > r.mindReader).length,
  }));
}

/** Players revealed together because their Spill Scores are equal (SPIL-04). */
export interface SpillGroup<T> {
  score: number;
  /** 1 + how many players spilled more: equal scores share a place, the next place skips. */
  place: number;
  rows: T[];
}

/** Reveal steps: one group per distinct Spill Score, lowest first, so ties appear together. */
export function spillGroups<T extends { score: number }>(rows: readonly T[]): SpillGroup<T>[] {
  const scores = [...new Set(rows.map((r) => r.score))].sort((a, b) => a - b);
  return scores.map((score) => ({
    score,
    place: 1 + rows.filter((r) => r.score > score).length,
    rows: rows.filter((r) => r.score === score),
  }));
}

/** Each player's Spill Score place and who shares it (SPIL-04). */
export function spillTies<T extends { playerId: string; score: number }>(
  rows: readonly T[],
): Map<string, { spillRank: number; tiedWith: string[] }> {
  return new Map(
    rows.map((r) => [
      r.playerId,
      {
        spillRank: 1 + rows.filter((o) => o.score > r.score).length,
        tiedWith: rows.filter((o) => o.score === r.score && o !== r).map((o) => o.playerId),
      },
    ]),
  );
}

/** Whether a rank is shared, so the list shows "T1, T1, 3" (SPIL-04). */
export function isTiedRank(rank: number, ranks: readonly number[]): boolean {
  return ranks.filter((r) => r === rank).length > 1;
}

export interface AnswerCount {
  questionId: string;
  yes: number;
  answered: number;
}

export interface Results {
  rows: ResultRow[];
  /** Points for every guess about a scored player, to store on the guess rows. */
  guessPoints: GuessPoints[];
  awards: AwardResult[];
  questionStats: QuestionStat[];
}

interface Participant {
  player: ResultsPlayer;
  joinedAt: number;
  answersSubmittedAt: number | null;
  guessesSubmittedAt: number | null;
  score: number;
}

/**
 * Who takes part in results. Players who left or were removed are out. Players marked sat_out
 * without having submitted answers sat out the answering phase: no score, not a guess target,
 * and their guesses do not count. Players marked sat_out after submitting answers only sat out
 * guessing, so they keep their score.
 */
export function isScored(player: ResultsPlayer): boolean {
  if (player.status === "active") return true;
  return player.status === "sat_out" && player.answersSubmittedAt != null;
}

function participants(input: ResultsInput): Participant[] {
  const qids = input.questions.map((q) => q.id);
  return input.players
    .filter(isScored)
    .map((player) => ({
      player,
      joinedAt: toMs(player.joinedAt),
      answersSubmittedAt: toMsOrNull(player.answersSubmittedAt),
      guessesSubmittedAt: toMsOrNull(player.guessesSubmittedAt),
      score: scoreForRound(player.answers, qids),
    }))
    .sort((a, b) =>
      a.joinedAt !== b.joinedAt ? a.joinedAt - b.joinedAt : a.player.id < b.player.id ? -1 : 1,
    );
}

const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

function validGuess(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

const clampGuess = (v: number) => Math.min(100, Math.max(0, v));

/** Per-question yes and answered counts (skips excluded) for every round question. */
export function countAnswers(input: ResultsInput): AnswerCount[] {
  const ps = participants(input);
  return input.questions.map((q) => {
    let yes = 0;
    let answered = 0;
    for (const { player } of ps) {
      const v = player.answers[q.id];
      if (v === "yes" || v === "no") answered++;
      if (v === "yes") yes++;
    }
    return { questionId: q.id, yes, answered };
  });
}

/** Pure and deterministic: the same input always gives the same rows, awards and stats. */
export function computeResults(input: ResultsInput): Results {
  const ps = participants(input);

  // Players who sat out answering have no score but can still guess ("They can still guess."),
  // so their guesses count toward the room's guess about everyone else.
  const guessers = input.players.filter((g) => g.status === "active" || g.status === "sat_out");

  // Every guess about a scored player, banded; the closest on each target earns the bonus.
  const guessPoints: GuessPoints[] = [];
  for (const target of ps) {
    const onTarget = guessers
      .filter((g) => g.id !== target.player.id && validGuess(g.guesses[target.player.id]))
      .map((g) => ({
        guesserId: g.id,
        diff: Math.abs(clampGuess(g.guesses[target.player.id]!) - target.score),
      }));
    const best = Math.min(...onTarget.map((g) => g.diff));
    const bonus = onTarget.length >= MIN_GUESSERS_FOR_BONUS;
    for (const g of onTarget) {
      const closest = bonus && g.diff === best;
      guessPoints.push({
        guesserId: g.guesserId,
        targetId: target.player.id,
        points: mindReaderPoints(g.diff) + (closest ? CLOSEST_BONUS : 0),
        closest,
      });
    }
  }

  // Stable order whatever order the players came in.
  guessPoints.sort((a, b) =>
    a.targetId !== b.targetId
      ? a.targetId < b.targetId
        ? -1
        : 1
      : a.guesserId < b.guesserId
        ? -1
        : a.guesserId > b.guesserId
          ? 1
          : 0,
  );

  const stats = ps.map((p) => {
    const about = guessers
      .filter((o) => o.id !== p.player.id)
      .map((o) => o.guesses[p.player.id])
      .filter(validGuess)
      .map(clampGuess);
    const mine = guessPoints.filter((g) => g.guesserId === p.player.id);
    return {
      p,
      avgGuessAbout: about.length ? Math.round(mean(about)) : p.score,
      mindReader: mine.reduce((sum, g) => sum + g.points, 0),
      bullseyes: mine.filter((g) => g.points - (g.closest ? CLOSEST_BONUS : 0) === 10).length,
      guessCount: mine.length,
    };
  });

  // The best guesser wins; the Spill Score describes a player and only orders ties.
  type Stat = (typeof stats)[number];
  const beats = (o: Stat, s: Stat) =>
    Number(o.guessCount > 0) - Number(s.guessCount > 0) || o.mindReader - s.mindReader;
  const ranked = [...stats].sort((a, b) => beats(b, a) || b.p.score - a.p.score);
  const rows: ResultRow[] = ranked.map((s) => ({
    playerId: s.p.player.id,
    nickname: s.p.player.nickname,
    score: s.p.score,
    label: labelFor(s.p.score).id,
    avgGuessAbout: s.avgGuessAbout,
    mindReader: s.mindReader,
    bullseyes: s.bullseyes,
    rank: 1 + ranked.filter((o) => beats(o, s) > 0).length,
    spillMode: s.p.player.spillMode,
  }));

  const candidates: AwardCandidate[] = stats.map((s) => ({
    playerId: s.p.player.id,
    nickname: s.p.player.nickname,
    score: s.p.score,
    avgGuessAbout: s.avgGuessAbout,
    mindReader: s.mindReader,
    guessCount: s.guessCount,
    joinedAt: s.p.joinedAt,
    answersSubmittedAt: s.p.answersSubmittedAt,
    guessesSubmittedAt: s.p.guessesSubmittedAt,
  }));

  const min = input.minAnswersForStats ?? MIN_ANSWERS_FOR_STATS;
  const questionStats: QuestionStat[] = input.questions
    .map((q, position) => {
      const said = ps.map((p) => ({ p, v: p.player.answers[q.id] }));
      const yesSayers = said.filter((a) => a.v === "yes");
      const answered = said.filter((a) => a.v === "yes" || a.v === "no").length;
      return {
        position,
        stat: {
          questionId: q.id,
          text: q.text,
          yes: answered >= min ? yesSayers.length : null,
          answered,
          spillNames: yesSayers.filter((a) => a.p.player.spillMode).map((a) => a.p.player.nickname),
        },
      };
    })
    .filter(({ stat }) => stat.answered > 0)
    // Counted questions first, most-yes first; the rest keep the order they were asked in.
    .sort((a, b) => {
      const ra = a.stat.yes === null ? -1 : a.stat.yes / a.stat.answered;
      const rb = b.stat.yes === null ? -1 : b.stat.yes / b.stat.answered;
      return rb - ra || a.position - b.position;
    })
    .map(({ stat }) => stat);

  return { rows, guessPoints, awards: pickAwards(candidates), questionStats };
}
