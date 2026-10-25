import { describe, expect, it } from "vitest";
import { filterText, fold, MAX_TEXT } from "@/lib/moderation/filter";

describe("player text filter", () => {
  it("lets ordinary answers through untouched", () => {
    expect(filterText("I once ate cereal with orange juice.")).toEqual({
      ok: true,
      text: "I once ate cereal with orange juice.",
    });
  });

  it("refuses slurs, also spelt with numbers, symbols or spaces", () => {
    expect(filterText("you are a f4g")).toMatchObject({ ok: false, reason: "blocked" });
    expect(filterText("such a r3tard move")).toMatchObject({ ok: false, reason: "blocked" });
    expect(filterText("r e t a r d")).toMatchObject({ ok: false, reason: "blocked" });
    expect(filterText("just kill yourself")).toMatchObject({ ok: false, reason: "blocked" });
  });

  it("does not trip on words that only contain a blocked word", () => {
    expect(filterText("Scunthorpe is lovely").ok).toBe(true);
    expect(filterText("I visited a raccoon sanctuary").ok).toBe(true);
    expect(filterText("my therapist said grape juice helps").ok).toBe(true);
  });

  it("refuses contact details so nobody can be found", () => {
    for (const t of [
      "dm me on www.example.com",
      "https://spil.party",
      "mail me at ama@example.com",
      "call 024 123 4567",
      "follow @ama_spills",
      "mysite.gh",
    ])
      expect(filterText(t)).toMatchObject({ ok: false, reason: "contact" });
  });

  it("masks swear words and keeps the answer", () => {
    expect(filterText("that was fucking wild")).toEqual({
      ok: true,
      text: "that was f****** wild",
    });
    expect(filterText("Sh1t happens")).toEqual({ ok: true, text: "S*** happens" });
  });

  it("refuses empty and over-long text", () => {
    expect(filterText("   ")).toMatchObject({ ok: false, reason: "empty" });
    expect(filterText("a".repeat(MAX_TEXT + 1))).toMatchObject({ ok: false, reason: "long" });
  });

  it("folds look-alike characters", () => {
    expect(fold("H3LL0 W0rld!")).toBe("hello worldi");
  });
});
