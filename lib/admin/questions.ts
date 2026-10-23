/** Question text rules and the bulk CSV import/export format. Pure. */
import { parseCsv, toCsv, unguard } from "./csv";

export const QUESTION_MIN = 8;
export const QUESTION_MAX = 120;
export const IMPORT_MAX_ROWS = 2000;
export const Q_STATUSES = ["live", "draft", "hidden"] as const;
export type QStatus = (typeof Q_STATUSES)[number];

/** Stored text never carries "Have you ever" and always ends with a question mark. */
export function normalizeQuestion(input: string): string {
  let text = input
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^have you ever[\s.,:]*/i, "")
    .trim();
  if (!text) return "";
  if (!text.endsWith("?")) text = `${text.replace(/[.!]+$/, "")}?`;
  return text;
}

export type QuestionTextError = "too_short" | "too_long" | null;

export function checkQuestion(text: string): QuestionTextError {
  if (text.length < QUESTION_MIN) return "too_short";
  if (text.length > QUESTION_MAX) return "too_long";
  return null;
}

export const dedupeKey = (packId: string, text: string) =>
  `${packId}\u0000${text.toLowerCase().replace(/\s+/g, " ").trim()}`;

export type ImportError =
  | "no_question_column"
  | "no_pack_column"
  | "unknown_pack"
  | "bad_status"
  | "too_short"
  | "too_long"
  | "too_many_rows"
  | "empty";

export type ImportResult = {
  rows: Array<{ packId: string; text: string; status: QStatus }>;
  duplicates: number;
  errors: Array<{ line: number; error: ImportError }>;
};

/**
 * Reads an import CSV. Needs a header row with `question` and either `pack_id` or `pack` (id or
 * name, any case); `status` is optional (default from the caller). Rows already in the pack, or
 * repeated in the file, are counted as duplicates and skipped. Line numbers are 1-based and
 * count the header.
 */
export function parseQuestionImport(
  csv: string,
  packs: ReadonlyArray<{ id: string; name: string }>,
  existing: ReadonlyArray<{ packId: string; text: string }>,
  defaultStatus: QStatus = "live",
): ImportResult {
  const result: ImportResult = { rows: [], duplicates: 0, errors: [] };
  const table = parseCsv(csv);
  if (table.length < 2) {
    result.errors.push({ line: 1, error: "empty" });
    return result;
  }
  const header = table[0]!.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const qCol = header.indexOf("question");
  const idCol = header.indexOf("pack_id");
  const packCol = header.indexOf("pack");
  const statusCol = header.indexOf("status");
  if (qCol < 0) result.errors.push({ line: 1, error: "no_question_column" });
  if (idCol < 0 && packCol < 0) result.errors.push({ line: 1, error: "no_pack_column" });
  if (result.errors.length) return result;
  if (table.length - 1 > IMPORT_MAX_ROWS) {
    result.errors.push({ line: 1, error: "too_many_rows" });
    return result;
  }

  const byId = new Map(packs.map((p) => [p.id.toLowerCase(), p.id]));
  const byName = new Map(packs.map((p) => [p.name.toLowerCase(), p.id]));
  const seen = new Set(existing.map((q) => dedupeKey(q.packId, q.text)));

  table.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const cell = (col: number) => (col >= 0 ? unguard(cells[col] ?? "").trim() : "");
    const ref = (idCol >= 0 ? cell(idCol) : "") || cell(packCol);
    const packId = byId.get(ref.toLowerCase()) ?? byName.get(ref.toLowerCase());
    if (!packId) return result.errors.push({ line, error: "unknown_pack" });
    const rawStatus = cell(statusCol).toLowerCase();
    const status = (rawStatus || defaultStatus) as QStatus;
    if (!Q_STATUSES.includes(status)) return result.errors.push({ line, error: "bad_status" });
    const text = normalizeQuestion(cell(qCol));
    const problem = checkQuestion(text);
    if (problem) return result.errors.push({ line, error: problem });
    const key = dedupeKey(packId, text);
    if (seen.has(key)) {
      result.duplicates += 1;
      return;
    }
    seen.add(key);
    result.rows.push({ packId, text, status });
  });
  return result;
}

export type ExportQuestion = {
  packId: string;
  packName: string;
  text: string;
  status: QStatus;
  answered: number;
  yes: number;
  reports: number;
};

export const EXPORT_HEADER = [
  "pack_id",
  "pack",
  "question",
  "status",
  "answered",
  "yes_rate",
  "reports",
] as const;

/** Yes rate as a whole percentage, or null when nobody answered yet. */
export function yesRate(yes: number, answered: number): number | null {
  return answered > 0 ? Math.round((yes / answered) * 100) : null;
}

/** The export is also a valid import file (pack_id, question and status columns). */
export function questionsToCsv(list: ReadonlyArray<ExportQuestion>) {
  return toCsv(
    EXPORT_HEADER,
    list.map((q) => {
      const rate = yesRate(q.yes, q.answered);
      return [
        q.packId,
        q.packName,
        `Have you ever ${q.text}`,
        q.status,
        q.answered,
        rate === null ? "" : `${rate}%`,
        q.reports,
      ];
    }),
  );
}

/**
 * Pack ids are slugs of the name plus a short random suffix so two packs never clash. The
 * database allows `^[a-z0-9_]{2,40}$`.
 */
export function packSlug(name: string, suffix: string) {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
  return `${base || "pack"}_${suffix}`;
}
