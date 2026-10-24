import { describe, expect, it } from "vitest";
import { bandFloor, isAgeBand, isRealAge, packsForFloor, toBand, youngestFloor } from "@/lib/game";

describe("age bands (SPIL-02)", () => {
  it("toBand boundaries", () => {
    expect(toBand(12)).toBe("under_13");
    expect(toBand(13)).toBe("13_15");
    expect(toBand(15)).toBe("13_15");
    expect(toBand(16)).toBe("16_17");
    expect(toBand(17)).toBe("16_17");
    expect(toBand(18)).toBe("18_plus");
    expect(toBand(99)).toBe("18_plus");
  });

  it("real ages are 1 to 99", () => {
    expect(isRealAge(0)).toBe(false);
    expect(isRealAge(1)).toBe(true);
    expect(isRealAge(99)).toBe(true);
    expect(isRealAge(100)).toBe(false);
    expect(isRealAge(12.5)).toBe(false);
  });

  it("floors and validation", () => {
    expect(bandFloor("13_15")).toBe(13);
    expect(bandFloor("16_17")).toBe(16);
    expect(bandFloor("18_plus")).toBe(18);
    expect(isAgeBand("18_plus")).toBe(true);
    expect(isAgeBand("under_13")).toBe(false);
    expect(isAgeBand(18)).toBe(false);
  });

  it("the youngest player sets the room floor", () => {
    expect(youngestFloor(["18_plus", "16_17", "18_plus"])).toBe(16);
    expect(youngestFloor(["18_plus", "13_15"])).toBe(13);
    expect(youngestFloor([])).toBe(18);
  });

  const packs = [
    { id: "classic", minAge: 13 },
    { id: "redflag", minAge: 16 },
    { id: "afterdark", minAge: 18 },
  ];

  it("a 15-year-old sees only 13+ packs", () => {
    expect(packsForFloor(packs, 13, true).map((p) => p.id)).toEqual(["classic"]);
  });

  it("a 16-year-old sees 13+ and 16+ packs", () => {
    expect(packsForFloor(packs, 16, true).map((p) => p.id)).toEqual(["classic", "redflag"]);
  });

  it("an adult sees everything, unless the 18+ flag is off", () => {
    expect(packsForFloor(packs, 18, true)).toHaveLength(3);
    expect(packsForFloor(packs, 18, false).map((p) => p.id)).toEqual(["classic", "redflag"]);
  });
});
