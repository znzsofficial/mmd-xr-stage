import { describe, expect, it } from "vitest";
import { HUD_COLORS } from "./hudAppearance";
import { buttonInks, type ButtonState } from "./pelvic/palette";

function luminance(hex: string) {
  const rgb = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

describe("stage HUD appearance", () => {
  it("keeps labels and key lettering legible through hover, selection, primary, stop and disabled states", () => {
    const pairs: [string,string][] = [
      [HUD_COLORS.ink, HUD_COLORS.surface], [HUD_COLORS.muted, HUD_COLORS.surface],
      [HUD_COLORS.ink, HUD_COLORS.control], [HUD_COLORS.primary, HUD_COLORS.selected],
      [HUD_COLORS.danger, HUD_COLORS.dangerSurface], [HUD_COLORS.disabled, HUD_COLORS.surface],
    ];
    const roles:ButtonState[] = [{}, {variant:'quiet'}, {variant:'tab', active:true}, {active:true}, {variant:'primary'}, {danger:true}, {variant:'stop'}];
    for (const role of roles) for (const hovered of [false,true]) for (const disabled of [false,true]) {
      const {letters, face}=buttonInks({...role, hovered, disabled});
      pairs.push([letters,face]);
    }
    for (const [foreground, background] of pairs) {
      const a = luminance(foreground), b = luminance(background);
      expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
