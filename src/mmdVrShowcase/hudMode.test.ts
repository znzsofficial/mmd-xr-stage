import { describe, expect, it } from "vitest";
import { resolveHudSurface } from "./hudMode";

describe("watching HUD visibility", () => {
  const watching = { watching: true, loading: false, pendingFailures: false, physicsDetails: false, diagnostics: false };
  it("keeps watching and adjusting distinct", () => {
    expect(resolveHudSurface(watching)).toBe("watch");
    expect(resolveHudSurface({ ...watching, watching: false })).toBe("adjust");
  });
  it("never hides load recovery behind compact mode or diagnostics", () => {
    expect(resolveHudSurface({ ...watching, pendingFailures: true })).toBe("load");
    expect(resolveHudSurface({ ...watching, loading: true, diagnostics: true })).toBe("load");
  });
  it("can open critical error details from every surface", () => {
    expect(resolveHudSurface({ ...watching, loading: true, physicsDetails: true })).toBe("physics");
    expect(resolveHudSurface({ ...watching, diagnostics: true })).toBe("diagnostics");
  });
});
