import { afterEach, describe, expect, it, vi } from "vitest";
import { haptic } from "@/lib/haptics";

// SPIL-31: buzz only where vibration exists and motion is welcome; never throw.
describe("haptic", () => {
  afterEach(() => vi.unstubAllGlobals());

  const setup = (reduce: boolean, vibrate?: (ms: number) => boolean) => {
    vi.stubGlobal("navigator", vibrate ? { vibrate } : {});
    vi.stubGlobal("matchMedia", () => ({ matches: reduce }));
  };

  it("vibrates for 10 ms by default", () => {
    const vibrate = vi.fn(() => true);
    setup(false, vibrate);
    haptic();
    expect(vibrate).toHaveBeenCalledWith(10);
  });
  it("skips with reduced motion", () => {
    const vibrate = vi.fn(() => true);
    setup(true, vibrate);
    haptic();
    expect(vibrate).not.toHaveBeenCalled();
  });
  it("does nothing without the Vibration API (iOS, desktop)", () => {
    setup(false);
    expect(() => haptic()).not.toThrow();
  });
  it("swallows a browser that throws", () => {
    setup(false, () => {
      throw new Error("blocked");
    });
    expect(() => haptic()).not.toThrow();
  });
});
