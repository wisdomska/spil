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
  packPlays: Array<{ packId: string; name: string; started: number }>;
  flagged: Array<{ questionId: string; text: string; count: number }>;
  /** Last 30 days, newest first, for the CSV export. */
  days: DayStats[];
};

export type AdminRoom = {
  id: string;
  code: string;
  packName: string;
  hostNickname: string | null;
  players: number;
  status: "lobby" | "answering" | "guessing" | "ready" | "revealed" | "closed";
  createdAt: string;
};

export type AdminPack = {
  id: string;
  name: string;
  blurb: string;
  icon: string;
  tone: "accent" | "inverse" | "raised";
  isAdult: boolean;
  heat: "spicy" | "explicit" | "intense" | null;
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
  yes: number;
  answered: number;
  reports: number;
  updatedAt: string;
};

export type AdminReport = {
  id: string;
  type: "question" | "nickname" | "other";
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
  settings: { questionsPerGame: number; minPlayers: number; maxPlayers: number };
  flags: Record<string, boolean>;
  canResetData: boolean;
};

export type ImportSummary = {
  added: number;
  duplicates: number;
  errors: Array<{ line: number; error: string }>;
};
