/**
 * The request each console section makes when it opens with no filters (owner request
 * 2026-11-13: the console was slow). Shared by the sections' queries, the background prefetch
 * and the server's preload hint, so all three ask for exactly the same URL and the browser and
 * TanStack Query can reuse one response. Pure.
 */
import { DEFAULT_PAGE_SIZE } from "./paging";
import type { Section } from "./roles";

/** Query string for a paged list: empty values left out, keys in the order given. */
export function pageQuery(params: Record<string, string | number | undefined>): string {
  return new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => [k, String(v)]),
  ).toString();
}

/** A query's cache key and the API path it reads (under /api/v1/admin). */
export type View = { key: readonly unknown[]; url: string };

const plain = (path: string): View => ({ key: ["admin", path], url: path });
const paged = (path: string, params: Record<string, string | number | undefined>): View => {
  const qs = pageQuery(params);
  return { key: ["admin", path, qs], url: `${path}?${qs}` };
};
const first = { page: 1, size: DEFAULT_PAGE_SIZE };

export const DEFAULT_VIEWS: Record<Section, View[]> = {
  overview: [plain("/overview")],
  rooms: [paged("/rooms", { ...first, status: "all" })],
  users: [paged("/users", { ...first, filter: "all" })],
  packs: [plain("/packs")],
  questions: [plain("/questions"), plain("/packs")],
  reports: [paged("/reports", { ...first, status: "open" })],
  inbox: [paged("/messages", { ...first, status: "all" })],
  audit: [paged("/audit", first)],
  settings: [plain("/settings")],
};

/** The section a console path shows ("/admin" is the overview). */
export function sectionOf(pathname: string): Section | null {
  const part = pathname.replace(/^\/admin\/?/, "").split("/")[0] || "overview";
  return part in DEFAULT_VIEWS ? (part as Section) : null;
}
