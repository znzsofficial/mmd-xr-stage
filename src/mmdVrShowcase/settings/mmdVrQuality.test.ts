import { describe, expect, it } from "vitest";
import { getMmdVrRenderProfile, resolveMmdVrFrameRate } from "./mmdVrQuality";

describe("getMmdVrRenderProfile", () => {
  it("applies XR and shadow quality overrides", () => {
    const profile = getMmdVrRenderProfile({
      renderQuality: "low",
      dprPref: "auto",
      frameRatePref: "auto",
      antialiasPref: "auto",
      shadowsPref: "on",
      gridPref: "auto",
      walkSpeedPref: "auto",
      framebufferScalePref: "1",
      foveationPref: "off",
      shadowResolutionPref: "high",
      advancedRenderOverrides: true,
    });

    expect(profile.shadows).toBe(true);
    expect(profile.shadowMapSize).toBe(2048);
    expect(profile.framebufferScale).toBe(1);
    expect(profile.foveation).toBe(0);
  });

  it("selects the closest supported refresh rate without exceeding the target", () => {
    const target120 = resolveMmdVrFrameRate("120", "mid");
    const target72 = resolveMmdVrFrameRate("72", "mid");

    expect(typeof target120 === "function" ? target120(new Float32Array([72, 80, 90])) : target120).toBe(90);
    expect(typeof target72 === "function" ? target72(new Float32Array([80, 90, 120])) : target72).toBe(80);
  });

  it("ignores stored renderer overrides until explicitly enabled", () => {
    const profile = getMmdVrRenderProfile({
      renderQuality: "balanced",
      dprPref: "auto",
      frameRatePref: "90",
      antialiasPref: "auto",
      shadowsPref: "auto",
      gridPref: "auto",
      walkSpeedPref: "auto",
      framebufferScalePref: "1",
      foveationPref: "off",
      shadowResolutionPref: "auto",
      advancedRenderOverrides: false,
    });

    expect(profile.framebufferScale).toBe(0.85);
    expect(profile.foveation).toBe(0.5);
  });
});
