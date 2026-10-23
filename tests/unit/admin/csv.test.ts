import { describe, expect, it } from "vitest";
import { csvCell, parseCsv, toCsv, unguard } from "@/lib/admin/csv";
import {
  checkQuestion,
  normalizeQuestion,
  packSlug,
  parseQuestionImport,
  questionsToCsv,
  yesRate,
} from "@/lib/admin/questions";
import { completionRate, fillDays, isoDay, statsToCsv, totalsSince } from "@/lib/admin/stats";

describe("parseCsv", () => {
  it("reads plain rows and drops blank lines", () => {
    expect(parseCsv("a,b\n1,2\n\n3,4\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("handles quotes, escaped quotes, commas and new lines inside cells", () => {
    expect(parseCsv('q,"said ""hi"", then left","two\nlines"')).toEqual([
      ["q", 'said "hi", then left', "two\nlines"],
    ]);
  });

  it("handles CRLF, a BOM, a missing final newline and empty cells", () => {
    expect(parseCsv("﻿a,b\r\n1,\r\n,2")).toEqual([
      ["a", "b"],
      ["1", ""],
      ["", "2"],
    ]);
  });
});

describe("toCsv", () => {
  it("quotes only when needed and uses CRLF", () => {
    expect(toCsv(["a", "b"], [["plain", 'has "quote", comma']])).toBe(
      'a,b\r\nplain,"has ""quote"", comma"\r\n',
    );
  });

  it("writes null and undefined as empty cells and numbers as text", () => {
    expect(toCsv(["n"], [[null], [undefined], [0]])).toBe("n\r\n\r\n\r\n0\r\n");
  });

  it("guards cells a spreadsheet would run as formulas, and unguards them on import", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(unguard("'=SUM(A1)")).toBe("=SUM(A1)");
    expect(unguard("'plain")).toBe("'plain");
  });

  it("round-trips through parseCsv", () => {
    const rows = [
      ["classic", 'said "no", twice?', "line\nbreak"],
      ["work", "", "x"],
    ];
    expect(parseCsv(toCsv(["a", "b", "c"], rows)).slice(1)).toEqual(rows);
  });
});

describe("question text", () => {
  it("strips Have you ever and adds the question mark", () => {
    expect(normalizeQuestion("  Have you ever   lied to a friend ")).toBe("lied to a friend?");
    expect(normalizeQuestion("have you ever, cried at a movie.")).toBe("cried at a movie?");
    expect(normalizeQuestion("sung in the shower?")).toBe("sung in the shower?");
    expect(normalizeQuestion("   ")).toBe("");
  });

  it("enforces the stored length", () => {
    expect(checkQuestion("lied?")).toBe("too_short");
    expect(checkQuestion(`${"a".repeat(120)}?`)).toBe("too_long");
    expect(checkQuestion("lied to a friend?")).toBeNull();
  });

  it("computes yes rates and slugs", () => {
    expect(yesRate(1, 3)).toBe(33);
    expect(yesRate(0, 0)).toBeNull();
    expect(packSlug("Campus Life!", "ab12")).toBe("campus_life_ab12");
    expect(packSlug("***", "ab12")).toBe("pack_ab12");
  });
});

describe("question import", () => {
  const packs = [
    { id: "classic", name: "Classic" },
    { id: "work", name: "9 to 5" },
  ];
  const existing = [{ packId: "classic", text: "lied to a friend?" }];

  it("accepts pack ids or names, defaults the status and skips duplicates", () => {
    const csv = [
      "pack,question,status",
      "classic,Have you ever lied to a friend?,live",
      "9 to 5,faked a sick day,draft",
      "WORK,faked a sick day?,",
      "classic,danced on a table,",
    ].join("\n");
    const r = parseQuestionImport(csv, packs, existing, "hidden");
    expect(r.errors).toEqual([]);
    expect(r.duplicates).toBe(2);
    expect(r.rows).toEqual([
      { packId: "work", text: "faked a sick day?", status: "draft" },
      { packId: "classic", text: "danced on a table?", status: "hidden" },
    ]);
  });

  it("prefers pack_id over pack, so the export imports cleanly", () => {
    const exported = questionsToCsv([
      {
        packId: "work",
        packName: "Renamed",
        text: "sent a reply-all by mistake?",
        status: "live",
        answered: 4,
        yes: 1,
        reports: 0,
      },
    ]);
    expect(exported).toContain("Have you ever sent a reply-all by mistake?");
    expect(exported).toContain("25%");
    const r = parseQuestionImport(exported, packs, []);
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      { packId: "work", text: "sent a reply-all by mistake?", status: "live" },
    ]);
  });

  it("reports bad rows with their line numbers", () => {
    const csv = [
      "Pack,Question,Status",
      "nope,stolen a pen at work",
      "classic,hi",
      "classic,sung karaoke badly,maybe",
      `classic,${"x".repeat(130)}`,
    ].join("\n");
    expect(parseQuestionImport(csv, packs, []).errors).toEqual([
      { line: 2, error: "unknown_pack" },
      { line: 3, error: "too_short" },
      { line: 4, error: "bad_status" },
      { line: 5, error: "too_long" },
    ]);
  });

  it("needs the question and pack columns and at least one row", () => {
    expect(parseQuestionImport("pack,text\nclassic,x", packs, []).errors).toEqual([
      { line: 1, error: "no_question_column" },
    ]);
    expect(parseQuestionImport("question\nhi there friend", packs, []).errors).toEqual([
      { line: 1, error: "no_pack_column" },
    ]);
    expect(parseQuestionImport("pack,question\n", packs, []).errors).toEqual([
      { line: 1, error: "empty" },
    ]);
  });

  it("caps the number of rows", () => {
    const rows = Array.from({ length: 2001 }, (_, i) => `classic,question number ${i}`);
    expect(parseQuestionImport(["pack,question", ...rows].join("\n"), packs, []).errors).toEqual([
      { line: 1, error: "too_many_rows" },
    ]);
  });
});

describe("overview stats", () => {
  const now = new Date("2026-10-23T10:00:00Z");
  const days = [
    { day: "2026-10-23", gamesStarted: 4, gamesFinished: 3, joins: 15 },
    { day: "2026-10-20", gamesStarted: 2, gamesFinished: 2, joins: 7 },
    { day: "2026-10-10", gamesStarted: 9, gamesFinished: 1, joins: 30 },
  ];

  it("computes completion rates", () => {
    expect(completionRate(4, 3)).toBe(75);
    expect(completionRate(0, 0)).toBeNull();
    expect(completionRate(1, 2)).toBe(100);
  });

  it("totals today and the last 7 days", () => {
    expect(isoDay(now)).toBe("2026-10-23");
    expect(isoDay(now, 6)).toBe("2026-10-17");
    expect(totalsSince(days, isoDay(now))).toEqual({
      gamesStarted: 4,
      gamesFinished: 3,
      joins: 15,
    });
    expect(totalsSince(days, isoDay(now, 6))).toEqual({
      gamesStarted: 6,
      gamesFinished: 5,
      joins: 22,
    });
  });

  it("zero fills missing days, newest first, and exports them", () => {
    const filled = fillDays(days, now, 4);
    expect(filled.map((d) => d.day)).toEqual([
      "2026-10-23",
      "2026-10-22",
      "2026-10-21",
      "2026-10-20",
    ]);
    expect(filled[1]).toEqual({ day: "2026-10-22", gamesStarted: 0, gamesFinished: 0, joins: 0 });
    expect(statsToCsv(filled.slice(0, 2))).toBe(
      "day,games_started,games_finished,joins,completion_rate\r\n2026-10-23,4,3,15,75%\r\n2026-10-22,0,0,0,\r\n",
    );
  });
});
