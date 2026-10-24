// Shared API contract between route handlers and the client (docs/TECH_SPEC.md section 12).
import type { AnswerValue, AwardId, LabelId, MinAge, PlayerStatus, RoomStatus } from "@/lib/game";

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

export type Pack = PackSummary & {
  blurb: string;
  tone: PackTone;
  region: string | null;
  questionCount: number;
  sortOrder: number;
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
    /** When guessing opened; the host may skip to the reveal 60 s later. */
    guessingAt?: string;
    settings: { minPlayers: number; maxPlayers: number };
    testPlayers: boolean;
    pollingOnly: boolean;
    /** Realtime channel id (room:{id}). */
    channel: string;
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
  /** Only when revealed. */
  results?: { rows: ResultRow[]; awards: AwardRow[]; questionStats: QuestionStatRow[] };
};

export type ApiErrorBody = { error: { code: string; message: string } };
