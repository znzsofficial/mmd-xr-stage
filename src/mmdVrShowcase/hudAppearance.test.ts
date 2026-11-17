import { describe, expect, it } from "vitest";
import { HUD_COLORS, useVrHudTheme } from "./hudAppearance";

function luminance(hex: string) {
  const rgb = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

describe("porcelain HUD appearance", () => {
  it("keeps text legible in normal, selected, disabled and danger states", () => {
    const pairs = [
      [HUD_COLORS.ink, HUD_COLORS.surface], [HUD_COLORS.muted, HUD_COLORS.surface],
      [HUD_COLORS.ink, HUD_COLORS.control], [HUD_COLORS.primary, HUD_COLORS.selected],
      [HUD_COLORS.danger, HUD_COLORS.dangerSurface], [HUD_COLORS.disabled, HUD_COLORS.surface],
    ];
    for (const [foreground, background] of pairs) {
      const a = luminance(foreground), b = luminance(background);
      expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("uses stable HUD tokens rather than deriving them from scene or preparation preferences", () => {
    const first = useVrHudTheme().accent;
    expect(useVrHudTheme().accent).toBe(first);
    expect(first.soft).toBe(HUD_COLORS.surface);
    expect(first.primary).toBe(HUD_COLORS.primary);
  });
});
