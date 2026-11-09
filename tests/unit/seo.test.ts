import { afterEach, describe, expect, it, vi } from "vitest";

// lib/seo reads the env when it loads, so each case imports a fresh copy.
async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v as string);
  return import("@/lib/seo");
}

afterEach(() => vi.unstubAllEnvs());

describe("siteVerification", () => {
  it("adds the Google and Bing tags on production", async () => {
    const { siteVerification } = await load({
      APP_ENV: "production",
      GOOGLE_SITE_VERIFICATION: " g-code ",
      BING_SITE_VERIFICATION: "b-code",
    });
    expect(siteVerification()).toEqual({ google: "g-code", other: { "msvalidate.01": "b-code" } });
  });

  it("adds only the codes that are set", async () => {
    const { siteVerification } = await load({
      APP_ENV: "production",
      GOOGLE_SITE_VERIFICATION: "g-code",
      BING_SITE_VERIFICATION: "",
    });
    expect(siteVerification()).toEqual({ google: "g-code" });
  });

  it("adds nothing off production or without codes", async () => {
    let seo = await load({ APP_ENV: "preview", GOOGLE_SITE_VERIFICATION: "g-code" });
    expect(seo.siteVerification()).toBeUndefined();
    seo = await load({
      APP_ENV: "production",
      GOOGLE_SITE_VERIFICATION: "",
      BING_SITE_VERIFICATION: "",
    });
    expect(seo.siteVerification()).toBeUndefined();
  });
});
