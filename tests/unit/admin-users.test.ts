import { describe, expect, it } from "vitest";
import { banEnds, nextSort, parseUserSort, sortDirection, usersToCsv } from "@/lib/admin/users";
import { bulkUserAction, userAction } from "@/lib/admin/schemas";
import { can } from "@/lib/admin/roles";
import type { AdminUser } from "@/lib/admin/types";

const NOW = new Date("2026-11-13T05:00:00.000Z");

describe("banEnds", () => {
  it("adds whole days", () => {
    expect(banEnds(1, NOW)).toBe("2026-11-14T05:00:00.000Z");
    expect(banEnds(30, NOW)).toBe("2026-12-13T05:00:00.000Z");
  });
  it("has no end for a ban until lifted", () => {
    expect(banEnds(null, NOW)).toBeNull();
  });
});

describe("user sort", () => {
  it("falls back to newest first", () => {
    expect(parseUserSort("nope")).toBe("joined_desc");
    expect(parseUserSort(null)).toBe("joined_desc");
    expect(parseUserSort("points_desc")).toBe("points_desc");
  });
  it("numbers start biggest first and flip", () => {
    expect(nextSort("joined_desc", "games")).toBe("games_desc");
    expect(nextSort("games_desc", "games")).toBe("games_asc");
    expect(nextSort("games_asc", "games")).toBe("games_desc");
  });
  it("names start A to Z", () => {
    expect(nextSort("joined_desc", "name")).toBe("name_asc");
    expect(nextSort("name_asc", "name")).toBe("name_desc");
  });
  it("reports the direction for aria-sort", () => {
    expect(sortDirection("seen_asc", "seen")).toBe("ascending");
    expect(sortDirection("seen_desc", "seen")).toBe("descending");
    expect(sortDirection("seen_desc", "games")).toBeUndefined();
  });
});

describe("user actions", () => {
  it("bans until lifted by default", () => {
    expect(userAction.parse({ action: "ban" })).toEqual({ action: "ban", reason: "", days: null });
  });
  it("only takes 1, 7 or 30 day bans", () => {
    expect(userAction.safeParse({ action: "ban", days: 7 }).success).toBe(true);
    expect(userAction.safeParse({ action: "ban", days: 3 }).success).toBe(false);
  });
  it("needs a name to rename", () => {
    expect(userAction.safeParse({ action: "rename", name: " " }).success).toBe(false);
  });
  it("bulk actions cap at 100 people and never delete", () => {
    const ids = Array.from({ length: 101 }, () => "00000000-0000-4000-8000-000000000001");
    expect(bulkUserAction.safeParse({ action: "signout", ids }).success).toBe(false);
    expect(
      bulkUserAction.safeParse({ action: "delete", ids: ids.slice(0, 1), confirm: "x" }).success,
    ).toBe(false);
  });
  it("moderators act on people; only owners delete", () => {
    expect(can("moderator", "users.act")).toBe(true);
    expect(can("content_lead", "users.act")).toBe(false);
    expect(can("moderator", "users.delete")).toBe(false);
    expect(can("owner", "users.delete")).toBe(true);
  });
});

describe("usersToCsv", () => {
  it("writes one row per person with no email column", () => {
    const row: AdminUser = {
      userId: "u1",
      kind: "guest",
      username: "=Zed",
      createdAt: "2026-11-01T00:00:00Z",
      lastSeen: null,
      games: 3,
      wins: 1,
      points: 20,
      crews: 0,
      banned: true,
      bannedUntil: null,
    };
    const csv = usersToCsv([row]);
    expect(csv.split(/\r?\n/)[0]).not.toMatch(/email/);
    expect(csv).toContain("guest");
    expect(csv).toContain("yes");
    // Spreadsheet formulas are neutralised by toCsv.
    expect(csv).not.toMatch(/(^|,)=Zed/m);
  });
});
