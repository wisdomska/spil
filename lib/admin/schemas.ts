/** Request bodies for /api/v1/admin (zod). Shared by the route handlers and their tests. */
import { z } from "zod";
import { ROLES } from "./roles";
import { Q_STATUSES } from "./questions";

export const PASSWORD_MIN = 10;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(120)
  .refine((v) => /^\S+@\S+\.\S+$/.test(v), "That email looks off.");
const password = z.string().min(PASSWORD_MIN).max(72);
const name = z.string().trim().min(2).max(40);

export const login = z.object({ email, password: z.string().min(1).max(200) });

export const completeReset = z.object({ password });

export const patchMe = z.object({ name, email, currentPassword: z.string().min(1).max(200) });

export const changePassword = z.object({
  currentPassword: z.string().min(1).max(200),
  password,
});

export const role = z.enum(ROLES);

export const addAdmin = z.object({ name, email, password, role });
export const patchAdmin = z.object({ role });

export const qStatus = z.enum(Q_STATUSES);
const packStatus = z.enum(["live", "draft", "hidden"]);
const heat = z.enum(["spicy", "explicit", "intense"]);

export const packBody = z
  .object({
    name: z.string().trim().min(2).max(40),
    blurb: z.string().trim().max(140),
    icon: z.string().trim().min(1).max(40),
    tone: z.enum(["accent", "inverse", "raised"]),
    isAdult: z.boolean(),
    heat: heat.nullable(),
    region: z
      .string()
      .trim()
      .toUpperCase()
      .pipe(z.enum(["GH", "NG"]))
      .nullable()
      .or(z.literal("").transform(() => null)),
    status: packStatus,
    sortOrder: z.number().int().min(0).max(10000),
  })
  .refine((p) => (p.isAdult ? p.heat !== null : p.heat === null), {
    message: "Adult packs need a heat level; other packs have none.",
    path: ["heat"],
  });

export const addQuestions = z.object({
  packId: z.string().trim().min(1).max(40),
  status: qStatus,
  texts: z.array(z.string().max(400)).min(1).max(200),
});

export const patchQuestion = z
  .object({
    text: z.string().max(400).optional(),
    packId: z.string().trim().min(1).max(40).optional(),
    status: qStatus.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Nothing to change.");

export const importQuestions = z.object({
  csv: z.string().min(1).max(1_000_000),
  defaultStatus: qStatus.default("live"),
});

export const reportAction = z.object({
  action: z.enum(["dismiss", "hide_question", "remove_player"]),
});

export const patchMessage = z.object({ status: z.enum(["new", "read", "archived"]) });

export const patchSettings = z
  .object({
    questionsPerGame: z.number().int().min(5).max(100),
    minPlayers: z.number().int().min(3).max(20),
    maxPlayers: z.number().int().min(3).max(20),
  })
  .refine((s) => s.maxPlayers >= s.minPlayers, {
    message: "Maximum players must be at least the minimum.",
    path: ["maxPlayers"],
  });

export const FLAG_KEYS = [
  "polling_only",
  "adult_packs_enabled",
  "test_players",
  "payments_enabled",
  "party_mode",
] as const;
export type FlagKeyName = (typeof FLAG_KEYS)[number];

export const patchFlag = z.object({ key: z.enum(FLAG_KEYS), enabled: z.boolean() });
