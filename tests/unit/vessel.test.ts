import { describe, expect, it } from "vitest";
import { crossesTen, levelForKey, levelFromPointer } from "@/lib/vessel";

describe("vessel input (SPIL-10)", () => {
  it("pointer at 0 %, 50 % and 100 % of the height maps to 100, 50 and 0", () => {
    const top = 200;
    const height = 380;
    expect(levelFromPointer(top, top, height)).toBe(100);
    expect(levelFromPointer(top + height / 2, top, height)).toBe(50);
    expect(levelFromPointer(top + height, top, height)).toBe(0);
  });

  it("clamps outside the vessel", () => {
    expect(levelFromPointer(0, 200, 380)).toBe(100);
    expect(levelFromPointer(900, 200, 380)).toBe(0);
  });

  it("keys: arrows 1, page 10, Home 0, End 100", () => {
    expect(levelForKey("ArrowUp", 50)).toBe(51);
    expect(levelForKey("ArrowLeft", 50)).toBe(49);
    expect(levelForKey("PageUp", 95)).toBe(100);
    expect(levelForKey("PageDown", 5)).toBe(0);
    expect(levelForKey("Home", 50)).toBe(0);
    expect(levelForKey("End", 50)).toBe(100);
    expect(levelForKey("a", 50)).toBeNull();
  });

  it("haptic tick on each multiple of 10", () => {
    expect(crossesTen(19, 20)).toBe(true);
    expect(crossesTen(21, 19)).toBe(true);
    expect(crossesTen(21, 22)).toBe(false);
    expect(crossesTen(30, 30)).toBe(false);
  });
});
