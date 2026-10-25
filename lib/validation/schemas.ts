import { z } from "zod";

export const packId = z.string().trim().min(1).max(40);
export const code = z
  .string()
  .transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, ""))
  .pipe(z.string().regex(/^[A-HJ-NP-Z2-9]{4}$/, "Room codes are 4 characters."));

export const nickname = z
  .string()
  .transform((v) => v.trim().replace(/\s+/g, " "))
  .pipe(z.string().min(2).max(16));

export const avatar = z.number().int().min(0).max(23);

/** SPIL-02: only the band ever reaches the server; under_13 is accepted so it can be refused. */
export const ageBand = z.enum(["under_13", "13_15", "16_17", "18_plus"]);

/** Game modes (Batch 1); the server also checks the mode is available and fits the room. */
export const mode = z.enum([
  "classic",
  "room_percentage",
  "hot_takes",
  "most_likely",
  "red_green",
  "rank_room",
  "imposter",
  "two_truths",
  "who_said",
  "spill_or_skip",
]);

export const createRoom = z.object({
  ageBand,
  mode: mode.default("classic"),
  packId,
  questionCount: z.number().int().min(1).max(100).optional(),
  captchaToken: z.string().optional(),
});

export const joinRoom = z.object({
  nickname: z.string(),
  avatar,
  ageBand,
});

export const setPack = z.object({
  packId,
  questionCount: z.number().int().min(1).max(100).optional(),
});

export const answerValue = z.enum(["yes", "no", "skip"]);
export const putAnswers = z.object({
  answers: z
    .array(z.object({ questionId: z.uuid(), value: answerValue }))
    .min(1)
    .max(100),
});

export const putGuesses = z.object({
  guesses: z
    .array(z.object({ targetId: z.uuid(), value: z.number().int().min(0).max(100) }))
    .min(1)
    .max(20),
});

export const advance = z.object({
  from: z.enum(["answering", "guessing", "ready"]),
});

export const playerTarget = z.object({ playerId: z.uuid() });

/** Two Truths: my card, two questions I said yes to and one I said no to. */
export const putPick = z.object({
  truths: z.array(z.uuid()).length(2),
  spill: z.uuid(),
});

/** Two Truths: the question I think is the spill on each card. */
export const putSpots = z.object({
  spots: z
    .array(z.object({ targetId: z.uuid(), questionId: z.uuid() }))
    .min(1)
    .max(20),
});

/** Imposter: the player I think had different questions. */
export const putSuspect = z.object({ targetId: z.uuid() });

/** Rank the Room: the whole room in order on each prompt, top first. */
export const putRanks = z.object({
  ranks: z
    .array(z.object({ questionId: z.uuid(), order: z.array(z.uuid()).min(2).max(20) }))
    .min(1)
    .max(100),
});

/** Most Likely To: one vote per prompt, for another player in the room. */
export const putVotes = z.object({
  votes: z
    .array(z.object({ questionId: z.uuid(), targetId: z.uuid() }))
    .min(1)
    .max(100),
});

/** Hot Takes: ratings of the round's statements, 0 to 100. */
export const putRatings = z.object({
  ratings: z
    .array(z.object({ questionId: z.uuid(), value: z.number().int().min(0).max(100) }))
    .min(1)
    .max(100),
});

/** Room Percentage: guesses of the room's yes share, by question. */
export const putPercent = z.object({
  guesses: z
    .array(z.object({ questionId: z.uuid(), value: z.number().int().min(0).max(100) }))
    .min(1)
    .max(100),
});

/** SPIL-11: the slide the host is moving on from. */
export const revealNext = z.object({ expected: z.number().int().min(0).max(1000) });

export const patchMe = z
  .object({
    spillMode: z.boolean().optional(),
    hideNameOnCard: z.boolean().optional(),
    nickname: z.string().optional(),
    avatar: avatar.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Nothing to change.");

export const rematch = z.object({
  packId: packId.optional(),
  questionCount: z.number().int().min(1).max(100).optional(),
});

export const testPlayers = z.object({ count: z.number().int().min(1).max(11) });

export const report = z.object({
  type: z.enum(["question", "nickname", "other"]),
  questionId: z.uuid().optional(),
  playerId: z.uuid().optional(),
  roomCode: z.string().optional(),
  reason: z.string().trim().min(1).max(280),
});

export const message = z.object({
  name: z.string().trim().max(60).optional(),
  email: z
    .string()
    .trim()
    .max(120)
    .optional()
    .refine((v) => !v || /^\S+@\S+\.\S+$/.test(v), "That email looks off."),
  body: z.string().trim().min(5).max(2000),
  captchaToken: z.string().optional(),
});
