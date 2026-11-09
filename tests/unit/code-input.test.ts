import { describe, expect, it } from "vitest";
import { cleanCode, codeIn } from "@/components/ui/CodeInput";

describe("codeIn (pasting on /join)", () => {
  it("finds the code in an invite link", () => {
    expect(codeIn("https://spil-party.vercel.app/r/8z6f")).toBe("8Z6F");
    expect(codeIn("https://spil-party.vercel.app/r/8Z6F/me")).toBe("8Z6F");
    expect(codeIn("https://spil-party.vercel.app/join?code=ABCD")).toBe("ABCD");
  });

  it("finds the code in a message or on its own", () => {
    expect(codeIn("Join my SPIL room: QW3R!")).toBe("QW3R");
    expect(codeIn(" qw-3r ")).toBe("QW3R");
  });

  it("gives null when there is no code", () => {
    expect(codeIn("hello there")).toBeNull();
    expect(codeIn("")).toBeNull();
    expect(codeIn("https://spil-party.vercel.app/r/OI01")).toBeNull();
  });

  it("typing still keeps four characters", () => {
    expect(cleanCode("abcde")).toBe("ABCD");
  });
});
