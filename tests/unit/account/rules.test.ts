import { describe, expect, it } from "vitest";
import {
  makeRecoveryCode,
  normalizeRecoveryCode,
  passwordProblem,
  usernameProblem,
} from "@/lib/account/rules";

describe("usernames", () => {
  it("are 3 to 20 letters, numbers and underscores", () => {
    expect(usernameProblem("Senya_7")).toBeNull();
    expect(usernameProblem("ab")).toBe("length");
    expect(usernameProblem("a".repeat(21))).toBe("length");
    expect(usernameProblem("no spaces")).toBe("chars");
    expect(usernameProblem("dots.no")).toBe("chars");
    expect(usernameProblem("émile")).toBe("chars");
  });

  it("go through the nickname filter", () => {
    expect(usernameProblem("fuck_you")).toBe("blocked");
    expect(usernameProblem("Shit")).toBe("blocked");
    expect(usernameProblem("Scunthorpe_fan")).toBeNull();
  });
});

describe("passwords", () => {
  it("need 10 or more characters", () => {
    expect(passwordProblem("short1")).toBe("short");
    expect(passwordProblem("tiger lily jam")).toBeNull();
  });

  it("refuse common ones, runs and repeats", () => {
    expect(passwordProblem("Password123")).toBe("common");
    expect(passwordProblem("1234567890")).toBe("common");
    expect(passwordProblem("abcdefghijk")).toBe("common");
    expect(passwordProblem("aaaaaaaaaaaa")).toBe("common");
  });

  it("refuse the username inside the password", () => {
    expect(passwordProblem("senya_7 forever", "Senya_7")).toBe("username");
  });
});

describe("recovery codes", () => {
  it("are four groups of four from an alphabet without look-alikes", () => {
    let i = 0;
    const code = makeRecoveryCode((max) => i++ % max);
    expect(code).toMatch(/^[2-9A-HJ-KM-NP-Z]{4}(-[2-9A-HJ-KM-NP-Z]{4}){3}$/);
    expect(code).not.toMatch(/[01OIL]/);
  });

  it("match however they were typed", () => {
    expect(normalizeRecoveryCode(" 7kqx m2rd-pw9t 4hzc ")).toBe("7KQXM2RDPW9T4HZC");
  });
});
