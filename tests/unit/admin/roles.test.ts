import { describe, expect, it } from "vitest";
import {
  can,
  canPatchQuestion,
  canSee,
  checkAdminChange,
  isRole,
  PERMISSIONS,
  sectionsFor,
  type AdminRole,
  type Permission,
} from "@/lib/admin/roles";

// The role matrix from docs/TECH_SPEC.md section 17, written out so a change is deliberate.
const MATRIX: Record<Permission, Record<AdminRole, boolean>> = {
  "overview.read": { owner: true, content_lead: true, moderator: true },
  "rooms.read": { owner: true, content_lead: false, moderator: true },
  "rooms.close": { owner: true, content_lead: false, moderator: true },
  "rooms.advance": { owner: true, content_lead: false, moderator: true },
  "packs.read": { owner: true, content_lead: true, moderator: true },
  "packs.write": { owner: true, content_lead: true, moderator: false },
  "questions.read": { owner: true, content_lead: true, moderator: true },
  "questions.write": { owner: true, content_lead: true, moderator: false },
  "questions.hide": { owner: true, content_lead: true, moderator: true },
  "reports.read": { owner: true, content_lead: false, moderator: true },
  "reports.act": { owner: true, content_lead: false, moderator: true },
  "inbox.read": { owner: true, content_lead: false, moderator: true },
  "inbox.act": { owner: true, content_lead: false, moderator: true },
  "audit.read": { owner: true, content_lead: true, moderator: true },
  "settings.write": { owner: true, content_lead: false, moderator: false },
  "admins.manage": { owner: true, content_lead: false, moderator: false },
  "account.self": { owner: true, content_lead: true, moderator: true },
  "data.reset": { owner: true, content_lead: false, moderator: false },
};

describe("admin roles", () => {
  it("covers every permission in the matrix", () => {
    expect(Object.keys(PERMISSIONS).sort()).toEqual(Object.keys(MATRIX).sort());
  });

  for (const [permission, roles] of Object.entries(MATRIX)) {
    for (const [role, allowed] of Object.entries(roles)) {
      it(`${role} ${allowed ? "can" : "cannot"} ${permission}`, () => {
        expect(can(role as AdminRole, permission as Permission)).toBe(allowed);
      });
    }
  }

  it("denies everything without a role", () => {
    expect(can(null, "overview.read")).toBe(false);
    expect(can(undefined, "account.self")).toBe(false);
  });

  it("recognises roles", () => {
    expect(isRole("owner")).toBe(true);
    expect(isRole("admin")).toBe(false);
    expect(isRole(3)).toBe(false);
  });

  it("shows each role its sections", () => {
    expect(sectionsFor("owner")).toEqual([
      "overview",
      "rooms",
      "packs",
      "questions",
      "reports",
      "inbox",
      "audit",
      "settings",
    ]);
    expect(sectionsFor("content_lead")).toEqual([
      "overview",
      "packs",
      "questions",
      "audit",
      "settings",
    ]);
    expect(sectionsFor("moderator")).toEqual([
      "overview",
      "rooms",
      "questions",
      "reports",
      "inbox",
      "audit",
      "settings",
    ]);
    expect(canSee(null, "overview")).toBe(false);
  });
});

describe("question edits by role", () => {
  it("lets owners and content leads change anything", () => {
    for (const role of ["owner", "content_lead"] as const) {
      expect(canPatchQuestion(role, { text: "x", status: "live" })).toBe(true);
      expect(canPatchQuestion(role, { packId: "classic" })).toBe(true);
    }
  });

  it("lets moderators only hide", () => {
    expect(canPatchQuestion("moderator", { status: "hidden" })).toBe(true);
    expect(canPatchQuestion("moderator", { status: "live" })).toBe(false);
    expect(canPatchQuestion("moderator", { status: "draft" })).toBe(false);
    expect(canPatchQuestion("moderator", { status: "hidden", text: "new text here" })).toBe(false);
    expect(canPatchQuestion("moderator", { status: "hidden", packId: "work" })).toBe(false);
    expect(canPatchQuestion(null, { status: "hidden" })).toBe(false);
    expect(canPatchQuestion("moderator", { status: "hidden", isSample: true })).toBe(false);
    expect(canPatchQuestion("content_lead", { isSample: true })).toBe(true);
  });
});

describe("admin account changes", () => {
  const owner = { userId: "a", role: "owner" as const };
  const owner2 = { userId: "b", role: "owner" as const };
  const mod = { userId: "c", role: "moderator" as const };

  it("never lets an admin change their own access", () => {
    expect(checkAdminChange(owner, owner, [owner, owner2], { remove: true })).toBe("SELF");
    expect(checkAdminChange(owner, owner, [owner, owner2], { role: "moderator" })).toBe("SELF");
  });

  it("keeps at least one owner", () => {
    const soleOwner = { userId: "d", role: "owner" as const };
    // A second actor that is somehow allowed (e.g. data drift) still cannot drop the last owner.
    expect(checkAdminChange(mod, soleOwner, [soleOwner, mod], { remove: true })).toBe("LAST_OWNER");
    expect(checkAdminChange(mod, soleOwner, [soleOwner, mod], { role: "content_lead" })).toBe(
      "LAST_OWNER",
    );
    expect(checkAdminChange(mod, soleOwner, [soleOwner, mod], { role: "owner" })).toBeNull();
  });

  it("allows changes to other admins while another owner remains", () => {
    expect(checkAdminChange(owner, owner2, [owner, owner2], { remove: true })).toBeNull();
    expect(checkAdminChange(owner, mod, [owner, mod], { role: "content_lead" })).toBeNull();
    expect(checkAdminChange(owner, mod, [owner, mod], { remove: true })).toBeNull();
  });
});
