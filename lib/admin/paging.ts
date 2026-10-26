/**
 * Admin table paging, shared by the API and the console (pure, no server or browser imports).
 * Page and size travel in the URL (?page=3&size=50), so a reload or a shared link opens the same
 * page.
 */
export const PAGE_SIZES = [10, 20, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 20;

export type Paged<T> = { rows: T[]; total: number; page: number; size: PageSize };

export function parsePage(raw: string | null | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? Math.min(n, 100_000) : 1;
}

export function parseSize(raw: string | null | undefined, fallback: PageSize = DEFAULT_PAGE_SIZE) {
  const n = Number(raw);
  return (PAGE_SIZES as readonly number[]).includes(n) ? (n as PageSize) : fallback;
}

export function pageCount(total: number, size: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / size));
}

/** Row range (inclusive) for a database query, after clamping the page to what exists. */
export function pageRange(page: number, size: number) {
  const from = (Math.max(1, page) - 1) * size;
  return { from, to: from + size - 1 };
}

export type PageItem = number | "gap";

/**
 * The page buttons to show: always the first and last page, the current one with `siblings` on
 * each side, and a gap marker where pages are skipped. A gap never hides a single page (1 … 3 is
 * shown as 1 2 3), so the row length stays steady while you move.
 */
export function pageItems(current: number, pages: number, siblings = 1): PageItem[] {
  const last = Math.max(1, pages);
  const page = Math.min(Math.max(1, current), last);
  // first + last + current + siblings + two gaps
  const slots = 2 * siblings + 5;
  if (last <= slots) return Array.from({ length: last }, (_, i) => i + 1);
  const left = Math.max(page - siblings, 1);
  const right = Math.min(page + siblings, last);
  const showLeftGap = left > 3;
  const showRightGap = right < last - 2;
  if (!showLeftGap) {
    const count = 3 + 2 * siblings;
    return [...Array.from({ length: count }, (_, i) => i + 1), "gap", last];
  }
  if (!showRightGap) {
    const count = 3 + 2 * siblings;
    return [1, "gap", ...Array.from({ length: count }, (_, i) => last - count + 1 + i)];
  }
  return [1, "gap", ...Array.from({ length: right - left + 1 }, (_, i) => left + i), "gap", last];
}
