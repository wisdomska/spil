import { describe, expect, it } from "vitest";
import { availableModes, parseSetupMode, setupModes } from "@/lib/game";
import { putGames, putNotice } from "@/lib/admin/schemas";

// Games switched off in the admin console (owner request 2026-11-12).
describe("games switched off", () => {
  it("leaves them out of the games a host can start", () => {
    expect(availableModes(18)).toContain("hot_takes");
    expect(availableModes(18, ["hot_takes"])).not.toContain("hot_takes");
  });
  it("leaves them out of the setup groups and the URL", () => {
    const all = setupModes(18, ["classic"]);
    expect(all.featured).toBeNull();
    expect(all.groups.flatMap((g) => g.modes)).not.toContain("classic");
    expect(parseSetupMode("classic", 18, ["classic"])).toBeNull();
    expect(parseSetupMode("classic", 18)).toBe("classic");
  });
  it("only takes known games", () => {
    expect(putGames.safeParse({ disabled: ["hot_takes"] }).success).toBe(true);
    expect(putGames.safeParse({ disabled: ["chess"] }).success).toBe(false);
  });
});

describe("player notice", () => {
  it("needs text to switch on", () => {
    expect(putNotice.safeParse({ text: "  ", on: true }).success).toBe(false);
    expect(putNotice.safeParse({ text: "", on: false }).success).toBe(true);
    expect(putNotice.safeParse({ text: "Back at 10", on: true }).success).toBe(true);
  });
  it("is one line of at most 200 characters", () => {
    expect(putNotice.safeParse({ text: "x".repeat(201), on: true }).success).toBe(false);
  });
});
