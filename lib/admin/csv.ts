/** Minimal RFC 4180 CSV reading and writing for the admin import and exports. Pure. */

const FORMULA = /^[=+\-@\t\r]/;

/** Parses CSV text into rows of cells. Handles quotes, escaped quotes, CRLF and a leading BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"' && cell === "") {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
    } else {
      cell += ch;
    }
    i += 1;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  // Drop blank lines.
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/**
 * Quotes a cell when needed. Cells that a spreadsheet would run as a formula get a leading
 * apostrophe (CSV injection guard); `unguard` strips it again on import.
 */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (FORMULA.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

export function unguard(value: string): string {
  return /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value;
}

/** Joins a header and rows into CSV text with CRLF line ends (what spreadsheets expect). */
export function toCsv(header: readonly string[], rows: ReadonlyArray<ReadonlyArray<unknown>>) {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
