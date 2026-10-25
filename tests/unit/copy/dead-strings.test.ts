import { describe, expect, it } from "vitest";
import messages from "@/messages/en.json";
import type { AnalyticsEvents } from "@/lib/analytics/events";

// SPIL-33: no theme toggle is rendered (dark only), so its strings and event are gone.
describe("dead theme strings", () => {
  it("has no theme namespace", () => {
    expect("theme" in messages).toBe(false);
    expect(JSON.stringify(messages)).not.toMatch(/toLight|toDark|Choose theme/);
  });
  it("has no theme analytics event", () => {
    const event: keyof AnalyticsEvents = "landing_viewed";
    expect(event).toBe("landing_viewed");
    // @ts-expect-error theme_changed was removed with the toggle
    const removed: keyof AnalyticsEvents = "theme_changed";
    expect(removed).toBe("theme_changed");
  });
});
