/**
 * Admin roles and what each may do (docs/TECH_SPEC.md section 17). Pure, shared by the API
 * (authoritative checks) and the console (hiding controls a role cannot use).
 */
export const ROLES = ["owner", "content_lead", "moderator"] as const;
export type AdminRole = (typeof ROLES)[number];

export type Permission =
  | "overview.read"
  | "rooms.read"
  | "rooms.close"
  | "packs.read"
  | "packs.write"
  | "questions.read"
  | "questions.write"
  | "questions.hide"
  | "reports.read"
  | "reports.act"
  | "inbox.read"
  | "inbox.act"
  | "audit.read"
  | "settings.write"
  | "admins.manage"
  | "account.self"
  | "data.reset";

const ALL: readonly AdminRole[] = ROLES;
const OWNER_MOD: readonly AdminRole[] = ["owner", "moderator"];
const OWNER_LEAD: readonly AdminRole[] = ["owner", "content_lead"];
const OWNER: readonly AdminRole[] = ["owner"];

export const PERMISSIONS: Record<Permission, readonly AdminRole[]> = {
  "overview.read": ALL,
  "rooms.read": OWNER_MOD,
  "rooms.close": OWNER_MOD,
  // Moderators read packs only to filter questions; they never edit them.
  "packs.read": ALL,
  "packs.write": OWNER_LEAD,
  "questions.read": ALL,
  "questions.write": OWNER_LEAD,
  "questions.hide": ALL,
  "reports.read": OWNER_MOD,
  "reports.act": OWNER_MOD,
  "inbox.read": OWNER_MOD,
  "inbox.act": OWNER_MOD,
  "audit.read": ALL,
  "settings.write": OWNER,
  "admins.manage": OWNER,
  "account.self": ALL,
  "data.reset": OWNER,
};

export function isRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function can(role: AdminRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return PERMISSIONS[permission].includes(role);
}

export const SECTIONS = [
  "overview",
  "rooms",
  "packs",
  "questions",
  "reports",
  "inbox",
  "audit",
  "settings",
] as const;
export type Section = (typeof SECTIONS)[number];

const SECTION_PERMISSION: Record<Section, Permission> = {
  overview: "overview.read",
  rooms: "rooms.read",
  // The Packs section is the editor; moderators reach packs through the Questions filter.
  packs: "packs.write",
  questions: "questions.read",
  reports: "reports.read",
  inbox: "inbox.read",
  audit: "audit.read",
  // Everyone can edit their own details and password here; owners also see the rest.
  settings: "account.self",
};

export function canSee(role: AdminRole | null | undefined, section: Section) {
  return can(role, SECTION_PERMISSION[section]);
}

export function sectionsFor(role: AdminRole | null | undefined): Section[] {
  return SECTIONS.filter((s) => canSee(role, s));
}

export type QuestionPatch = {
  text?: string;
  packId?: string;
  status?: "live" | "draft" | "hidden";
};

/** Moderators may only set a question to hidden; owners and content leads may change anything. */
export function canPatchQuestion(role: AdminRole | null | undefined, patch: QuestionPatch) {
  if (can(role, "questions.write")) return true;
  if (!can(role, "questions.hide")) return false;
  return patch.text === undefined && patch.packId === undefined && patch.status === "hidden";
}

type AdminLike = { userId: string; role: AdminRole };

/**
 * Role changes and removals must keep at least one owner, and an owner cannot remove or demote
 * themselves (so the console can never lock everyone out). Returns an error code or null.
 */
export function checkAdminChange(
  actor: AdminLike,
  target: AdminLike,
  admins: readonly AdminLike[],
  change: { remove: true } | { role: AdminRole },
): "SELF" | "LAST_OWNER" | null {
  if (actor.userId === target.userId) return "SELF";
  const demotes = "remove" in change || change.role !== "owner";
  if (target.role === "owner" && demotes) {
    const owners = admins.filter((a) => a.role === "owner").length;
    if (owners <= 1) return "LAST_OWNER";
  }
  return null;
}
