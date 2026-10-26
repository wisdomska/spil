import { describe, expect, it } from "vitest";
import { pageCount, pageItems, pageRange, parsePage, parseSize } from "@/lib/admin/paging";

describe("admin paging", () => {
  it("reads page and size from the URL safely", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-2")).toBe(1);
    expect(parsePage("2.5")).toBe(1);
    expect(parsePage(null)).toBe(1);
    expect(parseSize("50")).toBe(50);
    expect(parseSize("37")).toBe(20);
    expect(parseSize(undefined, 10)).toBe(10);
  });

  it("counts pages and rows", () => {
    expect(pageCount(0, 20)).toBe(1);
    expect(pageCount(370, 20)).toBe(19);
    expect(pageRange(2, 20)).toEqual({ from: 20, to: 39 });
  });

  it("shows every page when there are few", () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("shows first, last, the current page with neighbours, and gaps", () => {
    expect(pageItems(1, 19)).toEqual([1, 2, 3, 4, 5, "gap", 19]);
    expect(pageItems(4, 19)).toEqual([1, 2, 3, 4, 5, "gap", 19]);
    expect(pageItems(10, 19)).toEqual([1, "gap", 9, 10, 11, "gap", 19]);
    expect(pageItems(17, 19)).toEqual([1, "gap", 15, 16, 17, 18, 19]);
    expect(pageItems(19, 19)).toEqual([1, "gap", 15, 16, 17, 18, 19]);
  });

  it("keeps the row the same length while moving", () => {
    for (let p = 1; p <= 40; p++) expect(pageItems(p, 40)).toHaveLength(7);
  });

  it("clamps a page past the end", () => {
    expect(pageItems(99, 19)).toEqual([1, "gap", 15, 16, 17, 18, 19]);
  });
});
