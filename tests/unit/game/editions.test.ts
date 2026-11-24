import { describe, expect, it } from "vitest";
import {
  defaultEdition,
  editionForCountry,
  editionCounts,
  editionPlays,
  isEdition,
  packEditions,
} from "@/lib/game";

describe("editions", () => {
  it("knows which local editions a pack has", () => {
    expect(packEditions([null, null])).toEqual([]);
    expect(packEditions([null, "WA"])).toEqual(["GH", "NG"]);
    expect(packEditions(["GH"])).toEqual(["GH"]);
    expect(packEditions(["NG", null])).toEqual(["NG"]);
    expect(packEditions(["GH", "NG"])).toEqual(["GH", "NG"]);
  });

  it("maps a country to an edition", () => {
    expect(editionForCountry("GH")).toBe("GH");
    expect(editionForCountry("ng")).toBe("NG");
    expect(editionForCountry("GB")).toBe("global");
    expect(editionForCountry(null)).toBe("global");
  });

  it("pre-selects the last pick, then the country, then global", () => {
    expect(defaultEdition(["GH", "NG"], "NG", "GH")).toBe("NG");
    expect(defaultEdition(["GH", "NG"], "global", "GH")).toBe("global");
    expect(defaultEdition(["GH", "NG"], null, "GH")).toBe("GH");
    expect(defaultEdition(["NG"], null, "GH")).toBe("global");
    expect(defaultEdition(["GH"], "NG", "US")).toBe("global");
    expect(defaultEdition([], null, "NG")).toBe("global");
  });

  it("checks edition values", () => {
    expect(isEdition("GH")).toBe(true);
    expect(isEdition("US")).toBe(false);
    expect(isEdition(undefined)).toBe(false);
  });

  it("plays the same questions as the draw", () => {
    expect(editionPlays("global", null)).toBe(true);
    expect(editionPlays("global", "WA")).toBe(false);
    expect(editionPlays("GH", "WA")).toBe(true);
    expect(editionPlays("GH", "NG")).toBe(false);
    expect(editionPlays("NG", "NG")).toBe(true);
    expect(editionPlays("NG", "GH")).toBe(false);
  });

  it("counts what each edition plays, never zero for a pack with questions", () => {
    expect(editionCounts([null, null, "WA", "GH", "NG"])).toEqual({ global: 2, GH: 4, NG: 4 });
    expect(editionCounts(["GH", "GH"])).toEqual({ global: 2, GH: 2, NG: 2 });
  });
});
