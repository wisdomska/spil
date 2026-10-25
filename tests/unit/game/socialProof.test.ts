import { describe, expect, it } from "vitest";
import { ROOM_COUNT_FLOOR, showRoomCount } from "@/lib/game";

// SPIL-22: the weekly rooms line shows from 50 rooms.
describe("showRoomCount", () => {
  it("hides below the floor", () => {
    expect(ROOM_COUNT_FLOOR).toBe(50);
    expect(showRoomCount(0)).toBe(false);
    expect(showRoomCount(49)).toBe(false);
    expect(showRoomCount(Number.NaN)).toBe(false);
  });
  it("shows from the floor", () => {
    expect(showRoomCount(50)).toBe(true);
    expect(showRoomCount(1234)).toBe(true);
  });
});
