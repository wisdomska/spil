/** Every error code the API can return, with its HTTP status (docs/TECH_SPEC.md section 12). */
export const ERROR_STATUS = {
  BAD_REQUEST: 400,
  NAME_INVALID: 400,
  INCOMPLETE: 400,
  SKIP_LIMIT: 400,
  UNKNOWN_QUESTION: 400,
  INVALID_TARGET: 400,
  INVALID_COUNT: 400,
  CAPTCHA_FAILED: 400,
  WRONG_PASSWORD: 400,
  QUESTION_INVALID: 400,
  INVALID_CREDENTIALS: 401,
  UNAUTHENTICATED: 401,
  NOT_HOST: 403,
  NOT_IN_ROOM: 403,
  FORBIDDEN: 403,
  ROOM_NOT_FOUND: 404,
  PLAYER_NOT_FOUND: 404,
  NOT_FOUND: 404,
  WRONG_PHASE: 409,
  INVALID_TRANSITION: 409,
  DUPLICATE: 409,
  EMAIL_TAKEN: 409,
  LAST_OWNER: 409,
  CANNOT_CHANGE_SELF: 409,
  PACK_IN_USE: 409,
  QUESTION_IN_USE: 409,
  PACK_NOT_READY: 409,
  ALREADY_SUBMITTED: 409,
  NAME_TAKEN: 409,
  ROOM_FULL: 409,
  GAME_STARTED: 409,
  NOT_ENOUGH_PLAYERS: 409,
  PACK_NOT_ALLOWED: 409,
  MODE_UNAVAILABLE: 409,
  INVALID_PICK: 400,
  AGE_TOO_YOUNG: 403,
  AGE_RESTRICTED: 403,
  TOO_EARLY: 409,
  ROOM_EXPIRED: 410,
  PACK_UNAVAILABLE: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

const MESSAGES: Partial<Record<ErrorCode, string>> = {
  ROOM_NOT_FOUND: "No room with that code.",
  ROOM_EXPIRED: "This room has dried up.",
  ROOM_FULL: "This room is full.",
  GAME_STARTED: "This game already started.",
  NAME_TAKEN: "Someone in this room already has that name.",
  NAME_INVALID: "Pick a different nickname.",
  NOT_HOST: "Only the host can do that.",
  NOT_IN_ROOM: "You are not in this room.",
  WRONG_PHASE: "The room has moved on.",
  NOT_ENOUGH_PLAYERS: "Not enough players to start.",
  PACK_NOT_ALLOWED: "That pack is not available for this room.",
  MODE_UNAVAILABLE: "That game is not available for this room.",
  INVALID_PICK: "Pick two questions you said yes to and one you said no to.",
  AGE_TOO_YOUNG: "SPIL is for ages 13 and up.",
  AGE_RESTRICTED: "This room is playing an 18+ pack.",
  RATE_LIMITED: "Slow down a little.",
  TOO_EARLY: "Give them a minute first.",
  UNAUTHENTICATED: "Sign in first.",
  FORBIDDEN: "You do not have access to that.",
  INVALID_CREDENTIALS: "That email and password do not match.",
  WRONG_PASSWORD: "Your current password is not right.",
  EMAIL_TAKEN: "That email already has an account.",
  LAST_OWNER: "Keep at least one owner.",
  CANNOT_CHANGE_SELF: "Ask another owner to change your own access.",
  PACK_IN_USE: "Rooms still use this pack. Hide it instead.",
  QUESTION_IN_USE: "Rooms still use this question. Hide it instead.",
  PACK_NOT_READY: "Add at least one live question before publishing.",
  DUPLICATE: "That already exists.",
  INTERNAL: "Something went wrong.",
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  constructor(code: ErrorCode, message?: string) {
    super(message ?? MESSAGES[code] ?? code);
    this.code = code;
    this.status = ERROR_STATUS[code];
  }
}

/** Database functions raise the API code as the exception message (docs/DB.md). */
export function fromDbError(error: { message?: string } | null | undefined): ApiError {
  const code = error?.message?.trim();
  if (code && code in ERROR_STATUS) return new ApiError(code as ErrorCode);
  return new ApiError("INTERNAL");
}
