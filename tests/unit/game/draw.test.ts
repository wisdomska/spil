import { describe, expect, it } from "vitest";
import {
  drawQuestions,
  liveQuestionCount,
  pickablePacks,
  type DrawableQuestion,
  type PickablePack,
} from "@/lib/game";
import { seededRng } from "./fixtures";

const pool = (pack: string, n: number, status: DrawableQuestion["status"] = "live") =>
  Array.from({ length: n }, (_, i) => ({ id: `${pack}-${status}-${i}`, packId: pack, status }));

const qs: DrawableQuestion[] = [
  ...pool("classic", 12),
  ...pool("classic", 3, "hidden"),
  ...pool("classic", 2, "draft"),
  ...pool("work", 4),
];

describe("drawQuestions", () => {
  it("draws the requested count of unique live questions from the pack", () => {
    const drawn = drawQuestions(qs, "classic", 8, seededRng(1));
    expect(drawn).toHaveLength(8);
    expect(new Set(drawn.map((q) => q.id)).size).toBe(8);
    expect(drawn.every((q) => q.packId === "classic" && q.status === "live")).toBe(true);
  });

  it("draws all live questions when the pack has fewer than requested", () => {
    expect(drawQuestions(qs, "work", 12, seededRng(2))).toHaveLength(4);
    expect(drawQuestions(qs, "classic", 100, seededRng(2))).toHaveLength(12);
  });

  it("never draws hidden or draft questions", () => {
    for (let s = 0; s < 50; s++) {
      const drawn = drawQuestions(qs, "classic", 100, seededRng(s));
      expect(drawn.some((q) => q.status !== "live")).toBe(false);
    }
  });

  it("draws each duplicated id at most once", () => {
    const dup = [...pool("p", 3), ...pool("p", 3)];
    expect(drawQuestions(dup, "p", 10, seededRng(3))).toHaveLength(3);
  });

  it("returns nothing for zero, negative or unknown packs", () => {
    expect(drawQuestions(qs, "classic", 0)).toEqual([]);
    expect(drawQuestions(qs, "classic", -3)).toEqual([]);
    expect(drawQuestions(qs, "nope", 5)).toEqual([]);
  });

  it("floors fractional counts", () => {
    expect(drawQuestions(qs, "classic", 4.9, seededRng(4))).toHaveLength(4);
  });

  it("is deterministic with a seeded RNG and varies across seeds", () => {
    const a = drawQuestions(qs, "classic", 6, seededRng(9)).map((q) => q.id);
    const b = drawQuestions(qs, "classic", 6, seededRng(9)).map((q) => q.id);
    expect(a).toEqual(b);
    const orders = new Set(
      Array.from({ length: 20 }, (_, s) =>
        drawQuestions(qs, "classic", 6, seededRng(s))
          .map((q) => q.id)
          .join(),
      ),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it("reaches every live question across many draws", () => {
    const rng = seededRng(5);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++)
      for (const q of drawQuestions(qs, "classic", 3, rng)) seen.add(q.id);
    expect(seen.size).toBe(12);
  });

  it("does not mutate the input", () => {
    const copy = [...qs];
    drawQuestions(qs, "classic", 12);
    expect(qs).toEqual(copy);
  });
});

describe("pack picker", () => {
  const packs: PickablePack[] = [
    { id: "classic", status: "live" },
    { id: "work", status: "draft" },
    { id: "empty", status: "live" },
    { id: "hiddenonly", status: "live" },
    { id: "gone", status: "hidden" },
  ];
  const content = [...qs, ...pool("hiddenonly", 3, "hidden"), ...pool("gone", 2)];

  it("lists only live packs with at least one live question", () => {
    expect(pickablePacks(packs, content).map((p) => p.id)).toEqual(["classic"]);
  });

  it("counts live questions per pack", () => {
    expect(liveQuestionCount(content, "classic")).toBe(12);
    expect(liveQuestionCount(content, "hiddenonly")).toBe(0);
    expect(liveQuestionCount(content, "work")).toBe(4);
  });
});
