import { describe, expect, it } from "vitest";
import { AWAY_MS, eventForTransition, isGone, roomRecipients } from "@/lib/push/rules";

// Push notifications (owner request 2026-11-23): which phase changes buzz, and who.
describe("eventForTransition", () => {
  it("buzzes for the moments worth coming back for", () => {
    expect(eventForTransition("lobby", "answering")).toBe("started");
    expect(eventForTransition("answering", "guessing")).toBe("guessing");
    expect(eventForTransition("guessing", "ready")).toBe("ready");
    expect(eventForTransition("answering", "ready")).toBe("ready");
    expect(eventForTransition("revealed", "lobby")).toBe("rematch");
  });
  it("stays quiet for everything else", () => {
    expect(eventForTransition("ready", "revealed")).toBeNull();
    expect(eventForTransition("lobby", "closed")).toBeNull();
    expect(eventForTransition("ready", "ready")).toBeNull();
  });
});

describe("roomRecipients", () => {
  const now = Date.parse("2026-11-23T12:00:00Z");
  const away = new Date(now - AWAY_MS - 1000).toISOString();
  const here = new Date(now - 2000).toISOString();
  const p = (
    userId: string,
    o: Partial<{ isBot: boolean; status: string; lastSeenAt: string }> = {},
  ) => ({
    userId,
    isBot: false,
    status: "active",
    lastSeenAt: away,
    ...o,
  });

  it("buzzes real players who are not looking", () => {
    expect(
      roomRecipients(
        [p("a"), p("b", { lastSeenAt: here }), p("bot", { isBot: true })],
        "started",
        now,
      ),
    ).toEqual(["a"]);
  });
  it("never buzzes the person who caused it", () => {
    expect(roomRecipients([p("a"), p("host")], "started", now, "host")).toEqual(["a"]);
  });
  it("skips players who left or were removed", () => {
    expect(
      roomRecipients([p("a", { status: "left" }), p("b", { status: "removed" })], "ready", now),
    ).toEqual([]);
  });
  it("calls back players who sat out for a rematch, once each", () => {
    expect(roomRecipients([p("a", { status: "sat_out" }), p("a")], "rematch", now)).toEqual(["a"]);
    expect(roomRecipients([p("a", { status: "sat_out" })], "ready", now)).toEqual([]);
  });
});

describe("isGone", () => {
  it("drops subscriptions the push service no longer knows", () => {
    expect(isGone(404)).toBe(true);
    expect(isGone(410)).toBe(true);
    expect(isGone(500)).toBe(false);
    expect(isGone(undefined)).toBe(false);
  });
});
