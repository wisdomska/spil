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

export const createRoom = z.object({
  packId,
  questionCount: z.number().int().min(1).max(100).optional(),
  captchaToken: z.string().optional(),
});

export const joinRoom = z.object({
  nickname: z.string(),
  avatar,
  ageConfirmed: z.boolean().default(false),
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
