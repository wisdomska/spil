/** Every error code the API can return, with its HTTP status (docs/TECH_SPEC.md section 12). */
export const ERROR_STATUS = {
  BAD_REQUEST: 400,
  NAME_INVALID: 400,
  AGE_REQUIRED: 400,
  INCOMPLETE: 400,
  SKIP_LIMIT: 400,
  UNKNOWN_QUESTION: 400,
  INVALID_TARGET: 400,
  INVALID_COUNT: 400,
  CAPTCHA_FAILED: 400,
  UNAUTHENTICATED: 401,
  NOT_HOST: 403,
  NOT_IN_ROOM: 403,
  FORBIDDEN: 403,
  ROOM_NOT_FOUND: 404,
  PLAYER_NOT_FOUND: 404,
  NOT_FOUND: 404,
  WRONG_PHASE: 409,
  INVALID_TRANSITION: 409,
  ALREADY_SUBMITTED: 409,
  NAME_TAKEN: 409,
  ROOM_FULL: 409,
  GAME_STARTED: 409,
  NOT_ENOUGH_PLAYERS: 409,
  AGE_PENDING: 409,
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
  AGE_REQUIRED: "Confirm you are 18 or older to join this room.",
  NOT_HOST: "Only the host can do that.",
  NOT_IN_ROOM: "You are not in this room.",
  WRONG_PHASE: "The room has moved on.",
  NOT_ENOUGH_PLAYERS: "Not enough players to start.",
  AGE_PENDING: "Everyone has to confirm they are 18 or older first.",
  RATE_LIMITED: "Slow down a little.",
  UNAUTHENTICATED: "Sign in first.",
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
