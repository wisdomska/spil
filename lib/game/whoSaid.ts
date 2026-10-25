import { pickAwards, type AwardResult } from "./awards";
import { computeResults, type ResultRow, type Results, type ResultsInput } from "./results";
import { startingOrder } from "./rankRoom";
import { toMs } from "./types";

/**
 * Who Said That? (Batch 1, 18+ rooms only): everyone writes a short answer to each prompt (the
 * text filter runs first), then guesses who wrote each of the others' answers, which stay
 * anonymous until the reveal. A right guess earns points, and so does every player an answer
 * fools. A reported answer is hidden for everyone.
 */
export interface WrittenAnswer {
  id: string;
  playerId: string;
  questionId: string;
  body: string;
  hidden: boolean;
}

export interface WhoSaidInput extends ResultsInput {
  texts: readonly WrittenAnswer[];
  /** Each guesser's pick per answer id: the player they think wrote it. */
  whose: Readonly<Record<string, Readonly<Record<string, string | undefined>>>>;
  seed: string;
}

/** An answer while guessing: no author. */
export interface AnonAnswer {
  id: string;
  questionId: string;
  body: string;
}

export interface RevealedAnswer extends AnonAnswer {
  playerId: string;
  hidden: boolean;
  right: number;
  guessers: number;
}

export interface WhoSaidQuestion {
  questionId: string;
  text: string;
  answers: RevealedAnswer[];
}

export interface WhoSaidResults extends Results {
  said: WhoSaidQuestion[];
  /** Per player: right guesses and guesses made. */
  spotted: Readonly<Record<string, { right: number; total: number }>>;
}

export const RIGHT_AUTHOR = 10;
export const FOOLED_AUTHOR = 5;

const inGame = (p: { status: string }) => p.status === "active" || p.status === "sat_out";

/** The answers a viewer guesses on: everyone else's, shown answers only, shuffled per prompt. */
export function answersToGuess(
  input: Pick<WhoSaidInput, "questions" | "players" | "texts" | "seed">,
  viewerId: string,
): Array<{ questionId: string; text: string; answers: AnonAnswer[] }> {
  const players = new Set(input.players.filter(inGame).map((p) => p.id));
  return input.questions
    .map((q) => {
      const answers = input.texts.filter(
        (a) =>
          a.questionId === q.id && !a.hidden && a.playerId !== viewerId && players.has(a.playerId),
      );
      return {
        questionId: q.id,
        text: q.text,
        answers: startingOrder(answers, `${input.seed}:${q.id}`).map(
          ({ id, questionId, body }) => ({
            id,
            questionId,
            body,
          }),
        ),
      };
    })
    .filter((q) => q.answers.length > 0);
}

export function whoSaidResults(input: WhoSaidInput): WhoSaidResults {
  const base = computeResults(input);
  const players = input.players.filter(inGame);
  const ids = new Set(players.map((p) => p.id));
  const points = new Map<string, number>();
  const spotted: Record<string, { right: number; total: number }> = {};
  const add = (id: string, n: number) => points.set(id, (points.get(id) ?? 0) + n);

  const said: WhoSaidQuestion[] = input.questions
    .map((q) => {
      const answers = input.texts.filter((a) => a.questionId === q.id && ids.has(a.playerId));
      const shuffled = startingOrder(answers, `${input.seed}:${q.id}`);
      return {
        questionId: q.id,
        text: q.text,
        answers: shuffled.map((a) => {
          let right = 0;
          let guessers = 0;
          for (const g of players) {
            if (g.id === a.playerId || a.hidden) continue;
            const pick = input.whose[g.id]?.[a.id];
            if (!pick) continue;
            guessers += 1;
            const mine = (spotted[g.id] ??= { right: 0, total: 0 });
            mine.total += 1;
            if (pick === a.playerId) {
              right += 1;
              mine.right += 1;
              add(g.id, RIGHT_AUTHOR);
            } else add(a.playerId, FOOLED_AUTHOR);
          }
          return {
            id: a.id,
            questionId: a.questionId,
            body: a.body,
            playerId: a.playerId,
            hidden: a.hidden,
            right,
            guessers,
          };
        }),
      };
    })
    .filter((q) => q.answers.length > 0);

  // Most points first; Spill Score is not used. Equal points share a rank.
  const withPoints = base.rows.map((r) => ({
    ...r,
    mindReader: points.get(r.playerId) ?? 0,
    bullseyes: 0,
  }));
  const sorted = [...withPoints].sort(
    (a, b) => b.mindReader - a.mindReader || (a.nickname < b.nickname ? -1 : 1),
  );
  const rows: ResultRow[] = sorted.map((r) => ({
    ...r,
    rank: 1 + sorted.filter((o) => o.mindReader > r.mindReader).length,
  }));

  const byId = new Map(input.players.map((p) => [p.id, p]));
  const awards: AwardResult[] = pickAwards(
    rows.map((r) => ({
      playerId: r.playerId,
      nickname: r.nickname,
      score: r.score,
      avgGuessAbout: r.score,
      mindReader: r.mindReader,
      guessCount: spotted[r.playerId]?.total ?? 0,
      joinedAt: toMs(byId.get(r.playerId)!.joinedAt),
      answersSubmittedAt: byId.get(r.playerId)!.answersSubmittedAt
        ? toMs(byId.get(r.playerId)!.answersSubmittedAt!)
        : null,
      guessesSubmittedAt: byId.get(r.playerId)!.guessesSubmittedAt
        ? toMs(byId.get(r.playerId)!.guessesSubmittedAt!)
        : null,
    })),
  )
    .filter((a) => a.award === "mind_reader" || a.award === "clueless")
    .map((a, i) => ({ ...a, position: i + 1 }));

  return { ...base, rows, guessPoints: [], awards, said, spotted };
}
