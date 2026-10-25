import { pickAwards, type AwardResult } from "./awards";
import { computeResults, type ResultRow, type Results, type ResultsInput } from "./results";
import { startingOrder } from "./rankRoom";
import { toMs, type AnswerValue } from "./types";

/**
 * Two Truths and a Spill (Batch 1): everyone answers yes or no as usual, then picks three of
 * their own questions to show: two they said yes to (the truths) and one they said no to (the
 * spill, the lie). Showing them is the player's choice; nothing else is shown. Everyone else
 * spots the spill on each card. A right spot earns points, and so does every player a card fools.
 */
export interface TruthsPick {
  truths: readonly string[];
  spill: string;
}

export interface TwoTruthsInput extends ResultsInput {
  /** Each player's card: question ids. */
  picks: Readonly<Record<string, TruthsPick | undefined>>;
  /** Each guesser's spot per card owner: the question id they think is the spill. */
  spots: Readonly<Record<string, Readonly<Record<string, string | undefined>>>>;
  /** Shuffle seed, so the spill is not always in the same place. */
  seed: string;
}

export interface CardItem {
  questionId: string;
  text: string;
}

export interface TruthsCard {
  playerId: string;
  /** The three questions in a shuffled order. */
  items: CardItem[];
  spill: string;
  /** Spots per question id. */
  spotted: Record<string, number>;
  guessers: number;
  fooled: number;
}

export interface TwoTruthsResults extends Results {
  cards: TruthsCard[];
}

export const SPOTTED = 10;
export const FOOLED = 5;

/** A card is valid when both truths were answered yes and the spill no, all different. */
export function validPick(
  answers: Readonly<Record<string, AnswerValue | undefined>>,
  pick: TruthsPick | undefined,
): pick is TruthsPick {
  if (!pick || pick.truths.length !== 2) return false;
  const ids = [...pick.truths, pick.spill];
  if (new Set(ids).size !== 3) return false;
  return pick.truths.every((q) => answers[q] === "yes") && answers[pick.spill] === "no";
}

/** Whether a player can make a card at all: 2 or more yes answers and 1 or more no. */
export function canMakeCard(answers: Readonly<Record<string, AnswerValue | undefined>>): boolean {
  const values = Object.values(answers);
  return values.filter((v) => v === "yes").length >= 2 && values.includes("no");
}

/** The cards everyone sees while guessing: the three questions, shuffled, never the spill. */
export function truthsCards(input: Omit<TwoTruthsInput, "spots">): Array<{
  playerId: string;
  items: CardItem[];
}> {
  const text = new Map(input.questions.map((q) => [q.id, q.text]));
  return input.players
    .filter(
      (p) =>
        (p.status === "active" || p.status === "sat_out") &&
        validPick(p.answers, input.picks[p.id]),
    )
    .map((p) => {
      const pick = input.picks[p.id]!;
      const items = [...pick.truths, pick.spill].map((id) => ({
        id,
        questionId: id,
        text: text.get(id) ?? "",
      }));
      return {
        playerId: p.id,
        items: startingOrder(items, `${input.seed}:${p.id}`).map(({ questionId, text: t }) => ({
          questionId,
          text: t,
        })),
      };
    });
}

export function twoTruthsResults(input: TwoTruthsInput): TwoTruthsResults {
  const base = computeResults(input);
  const inGame = input.players.filter((p) => p.status === "active" || p.status === "sat_out");
  const shown = truthsCards(input);
  const points = new Map<string, number>();
  const guessed = new Map<string, number>();
  const add = (id: string, n: number) => points.set(id, (points.get(id) ?? 0) + n);

  const cards: TruthsCard[] = shown.map((card) => {
    const spill = input.picks[card.playerId]!.spill;
    const spotted: Record<string, number> = Object.fromEntries(
      card.items.map((i) => [i.questionId, 0]),
    );
    let guessers = 0;
    let fooled = 0;
    for (const g of inGame) {
      if (g.id === card.playerId) continue;
      const spot = input.spots[g.id]?.[card.playerId];
      if (!spot || !(spot in spotted)) continue;
      guessers += 1;
      guessed.set(g.id, (guessed.get(g.id) ?? 0) + 1);
      spotted[spot] = (spotted[spot] ?? 0) + 1;
      if (spot === spill) add(g.id, SPOTTED);
      else fooled += 1;
    }
    add(card.playerId, fooled * FOOLED);
    return { ...card, spill, spotted, guessers, fooled };
  });

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
      guessCount: guessed.get(r.playerId) ?? 0,
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

  return { ...base, rows, guessPoints: [], awards, cards };
}
