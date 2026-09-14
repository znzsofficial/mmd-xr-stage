import { describe, expect, it } from "vitest";
import { getSystemXrAccentTokens, getXrAccentTokens, normalizeXrThemeColor } from "./themeColor";

describe("XR theme colors", () => {
  it("defaults unknown values to blue", () => {
    expect(normalizeXrThemeColor(undefined)).toBe("blue");
    expect(normalizeXrThemeColor("orange")).toBe("blue");
  });

  it("keeps supported colors independent", () => {
    expect(getXrAccentTokens("cyan").primary).not.toBe(getXrAccentTokens("purple").primary);
    expect(normalizeXrThemeColor("red")).toBe("red");
  });

  it("derives every system accent for both XR color modes", () => {
    const accents = ["blue", "cyan", "emerald", "mint", "amber", "coral", "rose", "purple", "violet", "slate"] as const;
    for (const accent of accents) {
      const light = getSystemXrAccentTokens(accent, "light");
      const dark = getSystemXrAccentTokens(accent, "dark");
      expect(light.primary).toBeTruthy();
      expect(dark.primary).toBe(light.primary);
      expect(light.soft).not.toBe(dark.soft);
      expect(light.ink).not.toBe(dark.ink);
    }
  });

  it("falls back to the system coral accent for unknown values", () => {
    expect(getSystemXrAccentTokens("not-a-system-accent").primary).toBe(getSystemXrAccentTokens("coral").primary);
  });
});
