import { describe, expect, it } from "vitest";
import { parseProfile } from "@/lib/profile/device";

// SPIL-17: only a usable saved nickname and face prefill the form.
describe("parseProfile", () => {
  it("reads a saved profile", () => {
    expect(parseProfile('{"nickname":"Ama","avatar":3}', 24)).toEqual({
      nickname: "Ama",
      avatar: 3,
    });
  });
  it("trims and caps the nickname", () => {
    expect(parseProfile('{"nickname":"  Abenaaaaaaaaaaaaaaaaa ","avatar":0}', 24)?.nickname).toBe(
      "Abenaaaaaaaaaaaa",
    );
  });
  it.each([
    null,
    "",
    "not json",
    '{"nickname":"A","avatar":1}',
    '{"nickname":"Ama","avatar":24}',
    '{"nickname":"Ama","avatar":-1}',
    '{"nickname":"Ama","avatar":1.5}',
    '{"nickname":3,"avatar":1}',
  ])("ignores %s", (raw) => {
    expect(parseProfile(raw, 24)).toBeNull();
  });
});
