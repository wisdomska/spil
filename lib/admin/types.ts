// Response shapes of /api/v1/admin, shared by the route handlers and the console.
import type { AdminRole } from "./roles";
import type { DayStats } from "./stats";
import type { QStatus } from "./questions";

export type Me = { userId: string; name: string; email: string; role: AdminRole };

export type Counts = {
  liveRooms: number;
  packs: number;
  questions: number;
  openReports: number;
  newMessages: number;
};

export type Overview = {
  today: { gamesStarted: number; gamesFinished: number; joins: number };
  week: { gamesStarted: number; gamesFinished: number; joins: number };
  liveRooms: number;
  openReports: number;
  newMessages: number;
  /** SPIL-05: failed bot checks in the last 7 days. */
  captchaFailures: number;
  packPlays: Array<{ packId: string; name: string; started: number }>;
  flagged: Array<{ questionId: string; text: string; count: number }>;
  /** Last 30 days, newest first, for the CSV export and the trend chart. */
  days: DayStats[];
  /** Rooms started in the last 7 days, per game, most played first. */
  modePlays: Array<{ mode: string; started: number }>;
  /** People in a live room seen in the last five minutes, and current bans. */
  playingNow: number;
  banned: number;
  /** Live switches an admin should know are on. */
  noticeOn: boolean;
  gamesOff: number;
};

export type AdminRoom = {
  id: string;
  code: string;
  packName: string;
  mode: string;
  hostNickname: string | null;
  players: number;
  status: "lobby" | "answering" | "guessing" | "ready" | "revealed" | "closed";
  createdAt: string;
  /** Live phase with no change for 20 minutes (SPIL-01). */
  stuck: boolean;
};

/** A player account (owner request 2026-11-05). Never carries an email address. */
export type AdminUser = {
  userId: string;
  /** An account (username and password) or a guest who played without one. */
  kind: "account" | "guest";
  /** The account's username, or the name a guest last played under (null if none yet). */
  username: string | null;
  createdAt: string;
  /** Last sign-in or session refresh. */
  lastSeen: string | null;
  games: number;
  wins: number;
  points: number;
  crews: number;
  banned: boolean;
  /** When a timed ban ends; null with banned true means until an admin lifts it. */
  bannedUntil: string | null;
};

/** One person in full (admin_user_detail). Never an email address or what they answered. */
export type AdminUserDetail = {
  userId: string;
  kind: "account" | "guest";
  username: string | null;
  createdAt: string;
  lastSeen: string | null;
  /** Phones and browsers signed in right now. */
  sessions: number;
  ageBand: string | null;
  stats: {
    games: number;
    wins: number;
    points: number;
    hosted: number;
    bullseyes: number;
    modes: string[];
  } | null;
  dailyAnswers: number;
  nicknames: string[];
  rooms: Array<{
    roomId: string;
    code: string;
    mode: string;
    status: string;
    playerId: string;
    playerStatus: string;
    nickname: string;
    isHost: boolean;
    joinedAt: string;
  }>;
  liveRooms: number;
  crews: Array<{ crewId: string; name: string; nickname: string }>;
  reportsAgainst: Array<{ id: string; reason: string; status: string; createdAt: string }>;
  reportsAgainstTotal: number;
  reportsBy: number;
  ban: { reason: string; by: string; at: string; until: string | null } | null;
};

export type AdminUserSummary = {
  accounts: number;
  newAccounts: number;
  activeAccounts: number;
  /** Guests who joined a room or answered Today's Spill. */
  guests: number;
  newGuests: number;
  /** Every guest session, including visitors who never played. */
  visitors: number;
  banned: number;
  /** People in a live room seen in the last five minutes. */
  playingNow: number;
};

export type AdminPack = {
  id: string;
  name: string;
  blurb: string;
  icon: string;
  tone: "accent" | "inverse" | "raised";
  /** SPIL-02: 13, 16 or 18. 18+ packs get the black tile and only reach 18+ players. */
  minAge: 13 | 16 | 18;
  /** SPIL-08: picker section and 1 to 5 spice drops. */
  section: "everyday" | "life" | "after_dark";
  spice: number;
  premium: boolean;
  region: string | null;
  status: "live" | "draft" | "hidden";
  sortOrder: number;
  updatedAt: string;
  liveQuestions: number;
  totalQuestions: number;
  games: number;
};

export type AdminQuestion = {
  id: string;
  packId: string;
  text: string;
  status: QStatus;
  /** SPIL-08: shown in the pack preview. */
  isSample: boolean;
  yes: number;
  answered: number;
  reports: number;
  updatedAt: string;
};

export type AdminReport = {
  id: string;
  type: "question" | "nickname" | "other" | "answer";
  /** Who Said That?: the reported written answer, already hidden in the room. */
  answerText: string | null;
  questionId: string | null;
  questionText: string | null;
  questionStatus: QStatus | null;
  playerId: string | null;
  playerNickname: string | null;
  playerStatus: "active" | "left" | "removed" | "sat_out" | null;
  roomCode: string | null;
  reason: string;
  status: "open" | "actioned" | "dismissed";
  createdAt: string;
};

export type AdminMessage = {
  id: string;
  name: string | null;
  email: string | null;
  body: string;
  status: "new" | "read" | "archived";
  createdAt: string;
};

export type AuditRow = {
  id: number;
  at: string;
  who: string;
  action: string;
  target: string;
};

export type AdminAccount = {
  userId: string;
  name: string;
  email: string;
  role: AdminRole;
  createdAt: string;
};

export type SettingsPayload = {
  settings: {
    questionsPerGame: number;
    minPlayers: number;
    maxPlayers: number;
    ageLockHours: number;
  };
  flags: Record<string, boolean>;
  canResetData: boolean;
  /** The notice shown to players while on. */
  notice: { text: string; on: boolean };
  /** Games switched off for new rooms. */
  disabledModes: string[];
};

export type ImportSummary = {
  added: number;
  duplicates: number;
  errors: Array<{ line: number; error: string }>;
};
