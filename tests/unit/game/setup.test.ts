import { describe, expect, it } from "vitest";
import {
  MODE_GROUPS,
  MODES,
  packsForMode,
  parseSetupMode,
  setupModes,
  setupPath,
  withStoryVote,
  type PackFormat,
} from "@/lib/game";

// Two-step game setup: one tap when a game has one pack, a pack step when it has several.
const pack = (id: string, format: PackFormat, locked = false) => ({ id, format, locked });
const LIVE = [
  pack("classic", "yes_no"),
  pack("campus", "yes_no"),
  pack("hot_takes", "statements"),
  pack("most_likely", "prompts"),
  pack("red_green", "flags"),
  pack("imposter", "pairs"),
  pack("who_said", "open"),
];

describe("setupPath", () => {
  it("starts straight away when exactly one pack fits", () => {
    expect(setupPath(LIVE, "hot_takes")).toEqual({ kind: "start", packId: "hot_takes" });
    // Rank the Room plays the Most Likely To prompts.
    expect(setupPath(LIVE, "rank_room")).toEqual({ kind: "start", packId: "most_likely" });
  });

  it("asks for a pack when several fit", () => {
    expect(setupPath(LIVE, "classic")).toEqual({ kind: "choose", packs: 2 });
    expect(setupPath(LIVE, "two_truths")).toEqual({ kind: "choose", packs: 2 });
  });

  it("follows the packs this player may see", () => {
    // A younger band that only sees Classic gets the one-tap path for it.
    expect(setupPath([pack("classic", "yes_no")], "classic")).toEqual({
      kind: "start",
      packId: "classic",
    });
    // A second statements pack turns Hot Takes into a two-step game by itself.
    expect(setupPath([...LIVE, pack("hot2", "statements")], "hot_takes").kind).toBe("choose");
  });

  it("leaves locked premium packs out and says when nothing fits", () => {
    expect(packsForMode([pack("p", "flags", true)], "red_green")).toEqual([]);
    expect(setupPath([pack("p", "flags", true)], "red_green")).toEqual({ kind: "none" });
  });
});

describe("setup page", () => {
  it("leads with the classic and groups every other game but Spill or Skip", () => {
    const { featured, groups } = setupModes(18);
    expect(featured).toBe("classic");
    const shown = [featured, ...groups.flatMap((g) => g.modes)];
    expect(new Set(shown)).toEqual(new Set(MODES.filter((m) => m !== "spill_or_skip")));
    expect(MODE_GROUPS.map((g) => g.id)).toEqual(["guess", "vote", "bluff"]);
  });

  it("hides adult-only games below 18", () => {
    const shown = setupModes(13).groups.flatMap((g) => g.modes);
    expect(shown).not.toContain("who_said");
    expect(parseSetupMode("who_said", 13)).toBeNull();
    expect(parseSetupMode("who_said", 18)).toBe("who_said");
    expect(parseSetupMode("poker", 18)).toBeNull();
    expect(parseSetupMode(null, 18)).toBeNull();
  });

  it("turns the story vote on and off only for the classic game", () => {
    expect(withStoryVote("classic", true)).toBe("spill_or_skip");
    expect(withStoryVote("spill_or_skip", false)).toBe("classic");
    expect(withStoryVote("hot_takes", true)).toBe("hot_takes");
  });
});
