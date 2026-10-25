// Shared API contract between route handlers and the client (docs/TECH_SPEC.md section 12).
import type {
  AnswerValue,
  AwardId,
  LabelId,
  MinAge,
  Mode,
  PercentQuestion,
  PlayerStatus,
  RoomStatus,
  AnonAnswer,
  BestPlace,
  CardItem,
  Crowned,
  FlagQuestion,
  LoneFlag,
  HotTake,
  ImposterBoardRow,
  ImposterOutcome,
  LikelyQuestion,
  PackFormat,
  RankQuestion,
  SpillTally,
  SpillVote,
  TruthsCard,
  WhoSaidQuestion,
} from "@/lib/game";

export type HeatLevel = "spicy" | "explicit" | "intense";
export type PackTone = "accent" | "inverse" | "raised";

export type PackSummary = {
  id: string;
  name: string;
  icon: string;
  /** True when minAge is 18. */
  isAdult: boolean;
  heat: HeatLevel | null;
  /** SPIL-02: players whose age band starts below this never see the pack. */
  minAge: MinAge;
};

/** SPIL-08: where a pack sits in the picker. */
export type PackSection = "everyday" | "life" | "after_dark";

export type Pack = PackSummary & {
  blurb: string;
  section: PackSection;
  /** 1 to 5 drops in the preview. */
  spice: number;
  tone: PackTone;
  region: string | null;
  questionCount: number;
  sortOrder: number;
  /** Statements for Hot Takes, yes or no questions for every other mode. */
  format: PackFormat;
};

export type PublicRoom = {
  code: string;
  status: RoomStatus;
  pack: PackSummary;
  hostNickname: string | null;
  playerCount: number;
  maxPlayers: number;
  /** True when the caller already plays in this room. */
  joined: boolean;
  /** The room's minimum age; a guest whose band starts below it cannot join (SPIL-02). */
  minAge: MinAge;
  /** How long a minor's age stays locked on the device, in hours (admin setting). */
  ageLockHours: number;
};

export type StatePlayer = {
  id: string;
  nickname: string;
  avatar: number;
  rotationSeed: number;
  isHost: boolean;
  isBot: boolean;
  status: PlayerStatus;
  /** Answers saved this round (count only; never the values). */
  answered: number;
  /** When they last saved an answer this round (answering only). */
  lastAnswerAt?: string;
  answersSubmitted: boolean;
  guessesSubmitted: boolean;
};

export type ResultRow = {
  playerId: string;
  nickname: string;
  avatar: number;
  score: number;
  label: LabelId;
  avgGuessAbout: number;
  mindReader: number;
  /** Exact guesses this player made (SPIL-09 "Bullseye" stamp). */
  bullseyes?: number;
  /** How many people guessed about this player; 0 in a solo room. */
  guessedBy?: number;
  rank: number;
  /** Place by Spill Score: 1 + players who spilled more (SPIL-04). */
  spillRank?: number;
  /** Players with the same Spill Score; revealed together. */
  tiedWith?: string[];
};

export type AwardRow = {
  award: AwardId;
  playerId: string;
  reason: string;
  position: number;
};

export type QuestionStatRow = {
  questionId: string;
  text: string;
  /** Null when fewer than 3 answered (the count would expose someone's answers). */
  yes: number | null;
  answered: number;
  spillNames: string[];
};

export type RoomState = {
  room: {
    code: string;
    status: RoomStatus;
    round: number;
    pack: PackSummary;
    questionCount: number;
    revealedAt?: string;
    /** SPIL-11: the slide every phone shows, when it began, and how many there are. */
    reveal?: { index: number; at: string; total: number };
    /** The game mode this round plays (Batch 1). */
    mode: Mode;
    /** When guessing opened; the host may skip to the reveal 60 s later. */
    guessingAt?: string;
    settings: { minPlayers: number; maxPlayers: number };
    testPlayers: boolean;
    pollingOnly: boolean;
    /** Realtime channel id (room:{id}). */
    channel: string;
    /** Party Mode (Batch 2) is switched on: the host may pair a big screen. */
    partyMode: boolean;
  };
  me: {
    id: string;
    nickname: string;
    avatar: number;
    isHost: boolean;
    status: PlayerStatus;
    answersSubmitted: boolean;
    guessesSubmitted: boolean;
    spillMode: boolean;
    hideNameOnCard: boolean;
    /** Player ids I guess about this round (guessing only). Empty means nothing to guess. */
    targets: string[];
  };
  players: StatePlayer[];
  /** Only while answering, for this round. */
  questions?: Array<{ id: string; text: string }>;
  myAnswers?: Record<string, AnswerValue>;
  myGuesses?: Record<string, number>;
  /** Room Percentage, while guessing: the questions to guess the room's yes share for. */
  percentQuestions?: Array<{ id: string; text: string }>;
  /** Who Said That?, while answering: my answers so far, by question id. */
  myTexts?: Record<string, string>;
  /** Who Said That?, while guessing: everyone else's answers per prompt, no authors. */
  toGuess?: Array<{ questionId: string; text: string; answers: AnonAnswer[] }>;
  /** Who Said That?, while guessing: my guess per answer id. */
  myWhose?: Record<string, string>;
  /** Two Truths, while answering: my card if I have picked one. */
  myPick?: { truths: string[]; spill: string };
  /** Two Truths, while guessing: every card, shuffled, never saying which is the spill. */
  cards?: Array<{ playerId: string; items: CardItem[] }>;
  /** Two Truths, while guessing: my spot on each card, by card owner. */
  mySpots?: Record<string, string>;
  /** Imposter, while voting: everyone's numbers against the real questions. */
  board?: Array<Omit<ImposterBoardRow, "altText">>;
  /** Imposter, while voting: who I voted for. */
  mySuspect?: string;
  /** Rank the Room, while answering: my order on each prompt, player ids top first. */
  myRanks?: Record<string, string[]>;
  /** Most Likely To, while answering: my vote on each prompt, by question id. */
  myVotes?: Record<string, string>;
  /** Hot Takes, while answering: my ratings so far, by question id. */
  myRatings?: Record<string, number>;
  /** Room Percentage: my guesses so far, by question id. */
  myPercent?: Record<string, number>;
  /** Only when revealed. */
  results?: {
    rows: ResultRow[];
    /** Room Percentage: each scored question with the room's real share and every guess. */
    percent?: PercentQuestion[];
    /** Hot Takes: each player's take furthest from the room, by player id. */
    hottest?: Record<string, HotTake>;
    /** Most Likely To: vote counts per prompt, never who voted for whom. */
    likely?: LikelyQuestion[];
    /** Most Likely To: each player's strongest pick, by player id. */
    crowned?: Record<string, Crowned>;
    /** Red Flag, Green Flag: each scenario's split once 3 or more answered. */
    flags?: FlagQuestion[];
    /** Red Flag, Green Flag: the scenario each player was most outnumbered on, by player id. */
    lone?: Record<string, LoneFlag>;
    /** Rank the Room: the room's order per prompt once 3 or more ranked it. */
    ranked?: RankQuestion[];
    /** Rank the Room: each player's highest place, by player id. */
    best?: Record<string, BestPlace>;
    /** Imposter: the vote, who the imposter was, and every question with its alternative. */
    imposter?: ImposterOutcome;
    /** Two Truths: each card with its spill and how many spotted each question. */
    cards?: TruthsCard[];
    /** Who Said That?: each prompt's answers with their authors (hidden ones without text). */
    said?: WhoSaidQuestion[];
    /** Who Said That?: right guesses and guesses made, by player id. */
    spotted?: Record<string, { right: number; total: number }>;
    /** Spill or Skip: the options (Spill Mode yeses), votes, the pick and its answer. */
    spill?: SpillTally & { answer: "spill" | "skip" | null; myVote: SpillVote | null };
    /** Exact guesses, for the reveal's Bullseye stamps (SPIL-09, SPIL-11). */
    exact: Array<{ guesserId: string; targetId: string }>;
    awards: AwardRow[];
    questionStats: QuestionStatRow[];
  };
};

export type ApiErrorBody = { error: { code: string; message: string } };

/**
 * Party Mode: what a paired big screen sees. The room, the roster with progress, and the results
 * once revealed; never anyone's own answers, guesses or the imposter's questions.
 */
export type TvState = Pick<RoomState, "room" | "players" | "results"> & {
  /** The link phones open to join, for the lobby screen. */
  joinPath: string;
};
