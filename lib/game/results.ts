import { pickAwards, type AwardCandidate, type AwardResult } from "./awards";
import { labelFor, type LabelId } from "./labels";
import { scoreForRound } from "./scoring";
import { toMs, toMsOrNull, type AnswerValue, type PlayerStatus, type TimeInput } from "./types";

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
  /** Average accuracy of this player's guesses, 0 to 100; 0 when they made none. */
  mindReader: number;
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

export interface AnswerCount {
  questionId: string;
  yes: number;
  answered: number;
}

export interface Results {
  rows: ResultRow[];
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
  const byId = new Map(ps.map((p) => [p.player.id, p]));

  // Players who sat out answering have no score but can still guess ("They can still guess."),
  // so their guesses count toward the room's guess about everyone else.
  const guessers = input.players.filter((g) => g.status === "active" || g.status === "sat_out");

  const stats = ps.map((p) => {
    const about = guessers
      .filter((o) => o.id !== p.player.id)
      .map((o) => o.guesses[p.player.id])
      .filter(validGuess)
      .map(clampGuess);
    const accuracy: number[] = [];
    for (const [targetId, value] of Object.entries(p.player.guesses)) {
      const target = byId.get(targetId);
      if (!target || target === p || !validGuess(value)) continue;
      accuracy.push(100 - Math.abs(clampGuess(value) - target.score));
    }
    return {
      p,
      avgGuessAbout: about.length ? Math.round(mean(about)) : p.score,
      mindReader: accuracy.length ? Math.round(mean(accuracy)) : 0,
      guessCount: accuracy.length,
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

  return { rows, awards: pickAwards(candidates), questionStats };
}
