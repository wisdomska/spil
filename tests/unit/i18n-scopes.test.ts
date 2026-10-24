import { describe, expect, it } from "vitest";
import messages from "@/messages/en.json";
import { BASE_SCOPE, pickMessages, SCOPES } from "@/lib/i18n/pick";

describe("message scopes (SPIL-07)", () => {
  it("picks namespaces and dotted sub-namespaces", () => {
    const all = { a: { x: 1 }, b: { c: { d: 2 }, e: 3 }, f: 4 };
    expect(pickMessages(all, ["a", "b.c", "missing", "nope.deeper"])).toEqual({
      a: { x: 1 },
      b: { c: { d: 2 } },
    });
  });

  it("every scope path exists in the catalog", () => {
    for (const [scope, paths] of Object.entries(SCOPES))
      for (const path of [...BASE_SCOPE, ...paths]) {
        const picked = pickMessages(messages, [path]);
        expect(Object.keys(picked), `${scope}: ${path}`).toHaveLength(1);
      }
  });

  it("public scopes carry no admin strings", () => {
    for (const [scope, paths] of Object.entries(SCOPES)) {
      if (scope === "admin" || scope === "adminAuth") continue;
      const json = JSON.stringify(pickMessages(messages, [...BASE_SCOPE, ...paths]));
      for (const key of ["dangerBody", "auditNote", "flagSaved"])
        expect(json, `${scope} carries ${key}`).not.toContain(`"${key}"`);
    }
  });

  it("public scopes are a fraction of the catalog", () => {
    const full = JSON.stringify(messages).length;
    const landing = JSON.stringify(
      pickMessages(messages, [...BASE_SCOPE, ...SCOPES.landing]),
    ).length;
    expect(landing).toBeLessThan(full / 3);
  });
});
