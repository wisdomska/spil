import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "@/messages/en.json";

// SPIL-12: each Spill label reads as a sentence, not "You're a Been Around."
describe("results headline", () => {
  const t = createTranslator({ locale: "en", messages, namespace: "results" });
  const read = (label: string) => t.markup("headline", { label, em: (chunks) => `[${chunks}]` });

  it.each([
    ["fresh", "You're [Fresh Out The Box]."],
    ["innocent", "You're [Mostly Innocent]."],
    ["around", "You've [Been Around]."],
    ["main", "You're a [Main Character]."],
    ["menace", "You're a [Legendary Menace]."],
  ])("%s", (label, expected) => {
    expect(read(label)).toBe(expected);
  });
});
