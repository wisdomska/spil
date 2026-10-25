// Typed analytics events (SRS 14.2). Properties never include answers, guesses or question text.
export type AnalyticsEvents = {
  landing_viewed: Record<string, never>;
  room_created: { pack: string; questionCount: number; mode: string };
  room_link_opened: { via: "link" | "code" };
  player_joined: { pack: string; isHost: boolean };
  game_started: { pack: string; players: number; questionCount: number };
  answers_submitted: { skipped: number };
  guesses_submitted: Record<string, never>;
  phase_forced: { from: "answering" | "guessing" };
  reveal_skipped: Record<string, never>;
  room_revealed: { players: number };
  share_clicked: { format: "story" | "group"; action: "save" | "share" };
  invite_shared: { via: string };
  spill_mode_toggled: { on: boolean };
  rematch_started: { packChanged: boolean };
  question_reported: { reason: string };
  error_shown: { variant: string };
};

export type AnalyticsEvent = keyof AnalyticsEvents;
