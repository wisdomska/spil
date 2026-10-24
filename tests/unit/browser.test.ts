import { describe, expect, it } from "vitest";
import { browserFamily } from "@/lib/browser";

describe("browserFamily (SPIL-05)", () => {
  it("keeps only the family", () => {
    const chrome =
      "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
    expect(browserFamily(chrome)).toBe("chrome");
    expect(browserFamily(chrome + " Edg/130.0")).toBe("edge");
    expect(
      browserFamily(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("safari");
    expect(
      browserFamily("Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0"),
    ).toBe("firefox");
    expect(browserFamily(null)).toBe("other");
    expect(browserFamily("curl/8.0")).toBe("other");
  });
});
