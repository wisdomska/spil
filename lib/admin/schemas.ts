/** Request bodies for /api/v1/admin (zod). Shared by the route handlers and their tests. */
import { z } from "zod";
import { ROLES } from "./roles";
import { Q_STATUSES } from "./questions";
import { mode } from "@/lib/validation/schemas";

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

export const packBody = z.object({
  name: z.string().trim().min(2).max(40),
  blurb: z.string().trim().max(140),
  icon: z.string().trim().min(1).max(40),
  tone: z.enum(["accent", "inverse", "raised"]),
  /** SPIL-02: 13 (everyone), 16 or 18 (adult, black tile). */
  minAge: z.union([z.literal(13), z.literal(16), z.literal(18)]),
  /** SPIL-08: picker section and spice (1 to 5). */
  section: z.enum(["everyday", "life", "after_dark"]),
  spice: z.number().int().min(1).max(5),
  /** Batch 3: marked premium; only locked while the payments_enabled flag is on. */
  premium: z.boolean().default(false),
  region: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(z.enum(["GH", "NG"]))
    .nullable()
    .or(z.literal("").transform(() => null)),
  status: packStatus,
  sortOrder: z.number().int().min(0).max(10000),
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
    /** SPIL-08: use as a pack preview question. */
    isSample: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Nothing to change.");

export const importQuestions = z.object({
  csv: z.string().min(1).max(1_000_000),
  defaultStatus: qStatus.default("live"),
});

export const reportAction = z.object({
  action: z.enum(["dismiss", "hide_question", "remove_player"]),
});

/** Admin actions on one person (owner request 2026-11-12). */
export const USER_ACTIONS = ["ban", "unban", "kick", "signout", "rename", "delete"] as const;
export const BAN_DAYS = [1, 7, 30] as const;
const banFields = {
  reason: z.string().trim().max(300).default(""),
  /** Days the ban lasts; null bans until an admin lifts it. */
  days: z.union([z.literal(1), z.literal(7), z.literal(30), z.null()]).default(null),
};
export const userAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ban"), ...banFields }),
  z.object({ action: z.literal("unban") }),
  z.object({ action: z.literal("kick") }),
  z.object({ action: z.literal("signout") }),
  z.object({ action: z.literal("rename"), name: z.string().trim().min(1).max(20) }),
  z.object({ action: z.literal("delete"), confirm: z.string() }),
]);
export const bulkUserAction = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("ban"),
    ids: z.array(z.string().uuid()).min(1).max(100),
    ...banFields,
  }),
  z.object({ action: z.literal("unban"), ids: z.array(z.string().uuid()).min(1).max(100) }),
  z.object({ action: z.literal("kick"), ids: z.array(z.string().uuid()).min(1).max(100) }),
  z.object({ action: z.literal("signout"), ids: z.array(z.string().uuid()).min(1).max(100) }),
]);

export const USER_SORTS = [
  "joined_desc",
  "joined_asc",
  "seen_desc",
  "seen_asc",
  "games_desc",
  "games_asc",
  "points_desc",
  "points_asc",
  "name_asc",
  "name_desc",
] as const;
export type UserSort = (typeof USER_SORTS)[number];

export const patchMessage = z.object({ status: z.enum(["new", "read", "archived"]) });

export const patchSettings = z
  .object({
    questionsPerGame: z.number().int().min(5).max(100),
    minPlayers: z.number().int().min(1).max(20),
    maxPlayers: z.number().int().min(3).max(20),
    /** SPIL-02: hours a minor's age stays locked on their device. */
    ageLockHours: z.number().int().min(1).max(168),
  })
  .refine((s) => s.maxPlayers >= s.minPlayers, {
    message: "Maximum players must be at least the minimum.",
    path: ["maxPlayers"],
  });

/** The player notice (owner request 2026-11-12). Turning it on needs some text. */
export const putNotice = z
  .object({ text: z.string().trim().max(200), on: z.boolean() })
  .refine((n) => !n.on || n.text.length > 0, {
    message: "Write the notice first.",
    path: ["text"],
  });

export const putGames = z.object({ disabled: z.array(mode).max(20) });

export const FLAG_KEYS = [
  "polling_only",
  "adult_packs_enabled",
  "test_players",
  "payments_enabled",
  "party_mode",
] as const;
export type FlagKeyName = (typeof FLAG_KEYS)[number];

export const patchFlag = z.object({ key: z.enum(FLAG_KEYS), enabled: z.boolean() });
