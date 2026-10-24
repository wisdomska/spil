export type AwardId =
  "top_spiller" | "saint_of_the_room" | "mind_reader" | "dark_horse" | "open_book" | "clueless";

export type AwardTone = "accent" | "inverse" | "raised";
/** circle = fully round sticker; rounded = 40px corner radius. */
export type AwardShape = "circle" | "rounded";

export interface AwardMeta {
  id: AwardId;
  name: string;
  /** Phosphor icon name (regular weight). */
  icon: string;
  tone: AwardTone;
  shape: AwardShape;
}

/** Fixed reveal order (TECH_SPEC 13.4, HANDOFF reveal choreography). */
export const AWARDS: readonly AwardMeta[] = [
  { id: "top_spiller", name: "Top Spiller", icon: "drop", tone: "accent", shape: "circle" },
  {
    id: "saint_of_the_room",
    name: "Saint of the Room",
    icon: "hands-praying",
    tone: "inverse",
    shape: "rounded",
  },
  { id: "mind_reader", name: "Mind Reader", icon: "eye", tone: "raised", shape: "circle" },
  { id: "dark_horse", name: "Dark Horse", icon: "horse", tone: "inverse", shape: "circle" },
  { id: "open_book", name: "Open Book", icon: "book-open", tone: "accent", shape: "rounded" },
  { id: "clueless", name: "Clueless", icon: "question", tone: "raised", shape: "circle" },
];

/** What award selection needs to know about each scored player. Times are epoch ms. */
export interface AwardCandidate {
  playerId: string;
  nickname: string;
  score: number;
  avgGuessAbout: number;
  mindReader: number;
  /** Guesses this player made that counted toward Mind Reader. */
  guessCount: number;
  joinedAt: number;
  answersSubmittedAt: number | null;
  guessesSubmittedAt: number | null;
}

export interface AwardResult extends AwardMeta {
  award: AwardId;
  playerId: string;
  reason: string;
  /** 1 to 6, the reveal order. */
  position: number;
}

type Compare = (a: AwardCandidate, b: AwardCandidate) => number;

/** Three-way compare that stays well defined for Infinity (Infinity - Infinity is NaN). */
const cmp = (x: number, y: number) => (x === y ? 0 : x < y ? -1 : 1);
const asc =
  (key: (c: AwardCandidate) => number): Compare =>
  (a, b) =>
    cmp(key(a), key(b));
const desc =
  (key: (c: AwardCandidate) => number): Compare =>
  (a, b) =>
    cmp(key(b), key(a));

/** Missing submit time sorts after every real one: never "earliest", always "latest". */
const time = (t: number | null) => t ?? Number.POSITIVE_INFINITY;

/** Final fallbacks so selection is total and deterministic: earliest join, then id. */
const stable: Compare[] = [
  asc((c) => c.joinedAt),
  (a, b) => (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0),
];

function best(cands: readonly AwardCandidate[], ...keys: Compare[]): AwardCandidate {
  const chain = [...keys, ...stable];
  return [...cands].sort((a, b) => {
    for (const compare of chain) {
      const r = compare(a, b);
      if (r !== 0) return r;
    }
    return 0;
  })[0] as AwardCandidate;
}

const gap = (c: AwardCandidate) => c.score - c.avgGuessAbout;

/**
 * Picks the six awards in reveal order, one winner each (a player can win several).
 * Tie-breaks follow the TECH_SPEC 13.4 table, then earliest join, then player id.
 * Mind Reader and Clueless only consider players who made at least one guess, unless nobody did.
 * Returns an empty list when there are no candidates.
 */
/** SRS 4.3: no awards below this many scored players. */
export const MIN_PLAYERS_FOR_AWARDS = 3;
/** SRS 4.3: Clueless only appears in rooms of this size or more. */
export const MIN_PLAYERS_FOR_CLUELESS = 5;

export function pickAwards(candidates: readonly AwardCandidate[]): AwardResult[] {
  if (candidates.length < MIN_PLAYERS_FOR_AWARDS) return [];
  const guessers = candidates.filter((c) => c.guessCount > 0);
  const readers = guessers.length > 0 ? guessers : candidates;

  const top = best(
    candidates,
    desc((c) => c.score),
    asc((c) => time(c.answersSubmittedAt)),
  );
  const saint = best(
    candidates,
    asc((c) => c.score),
    asc((c) => time(c.answersSubmittedAt)),
  );
  const mind = best(
    readers,
    desc((c) => c.mindReader),
    asc((c) => time(c.guessesSubmittedAt)),
  );
  // Dark Horse needs someone who scored above what the room guessed (a positive gap).
  const surprises = candidates.filter((c) => gap(c) > 0);
  const dark =
    surprises.length > 0
      ? best(
          surprises,
          desc(gap),
          desc((c) => Math.abs(gap(c))),
        )
      : null;
  // Open Book is the opposite story, so it goes to someone other than the Dark Horse.
  const openPool = dark ? candidates.filter((c) => c !== dark) : candidates;
  const open = best(
    openPool.length > 0 ? openPool : candidates,
    asc((c) => Math.abs(gap(c))),
  );
  const clue = best(
    readers,
    asc((c) => c.mindReader),
    desc((c) => time(c.guessesSubmittedAt)),
  );

  const winners: Record<AwardId, [AwardCandidate, string] | null> = {
    top_spiller: [top, `Highest score in the room. ${top.score} out of 100.`],
    saint_of_the_room: [saint, `Scored ${saint.score}. Either a saint or a very good liar.`],
    mind_reader: [mind, `Closest guesses in the room. ${mind.mindReader} points.`],
    dark_horse: dark && [
      dark,
      `The room guessed ${dark.avgGuessAbout}. ${dark.nickname} scored ${dark.score}.`,
    ],
    open_book: [
      open,
      `The room guessed ${open.avgGuessAbout}. ${open.nickname} scored ${open.score}. Close enough.`,
    ],
    clueless:
      candidates.length >= MIN_PLAYERS_FOR_CLUELESS
        ? [clue, `Furthest guesses in the room. ${clue.nickname}, really?`]
        : null,
  };

  return AWARDS.flatMap((meta) => {
    const won = winners[meta.id];
    return won ? [{ ...meta, award: meta.id, playerId: won[0].playerId, reason: won[1] }] : [];
  }).map((a, i) => ({ ...a, position: i + 1 }));
}
