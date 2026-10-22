import { describe, expect, it } from "vitest";
import { LABELS, labelById, labelFor } from "@/lib/game";

describe("labels", () => {
  it.each([
    [0, "Fresh Out The Box"],
    [15, "Fresh Out The Box"],
    [16, "Mostly Innocent"],
    [35, "Mostly Innocent"],
    [36, "Been Around"],
    [55, "Been Around"],
    [56, "Main Character"],
    [75, "Main Character"],
    [76, "Legendary Menace"],
    [100, "Legendary Menace"],
  ])("score %i is %s", (score, name) => {
    expect(labelFor(score).name).toBe(name);
  });

  it("covers 0 to 100 with no gaps or overlaps", () => {
    for (let s = 0; s <= 100; s++) {
      expect(LABELS.filter((l) => s >= l.min && s <= l.max)).toHaveLength(1);
    }
  });

  it("uses the sticker tone and shape from the spec", () => {
    const by = Object.fromEntries(LABELS.map((l) => [l.id, l.sticker]));
    expect(by.fresh_out_the_box).toEqual({
      tone: "ink",
      shape: "square",
      condensed: false,
      caps: false,
    });
    expect(by.mostly_innocent).toEqual({
      tone: "raised",
      shape: "pill",
      condensed: false,
      caps: false,
    });
    expect(by.been_around).toEqual({ tone: "accent", shape: "tag", condensed: false, caps: false });
    expect(by.main_character).toEqual({
      tone: "accent",
      shape: "pill",
      condensed: true,
      caps: false,
    });
    expect(by.legendary_menace).toEqual({
      tone: "ink",
      shape: "square",
      condensed: true,
      caps: true,
    });
  });

  it("rounds fractions and clamps out-of-range scores", () => {
    expect(labelFor(15.4).id).toBe("fresh_out_the_box");
    expect(labelFor(15.5).id).toBe("mostly_innocent");
    expect(labelFor(-5).id).toBe("fresh_out_the_box");
    expect(labelFor(140).id).toBe("legendary_menace");
  });

  it("rejects non-finite scores", () => {
    expect(() => labelFor(Number.NaN)).toThrow(RangeError);
    expect(() => labelFor(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it("looks labels up by id", () => {
    expect(labelById("been_around").name).toBe("Been Around");
    expect(() => labelById("nope" as never)).toThrow(RangeError);
  });
});
