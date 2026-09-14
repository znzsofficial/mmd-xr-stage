import {
  applyCommonQualityAxes,
  formatDprLabel,
  formatFrameRateLabel,
  formatOnOff,
  type ImmersiveAntialiasPref,
  type ImmersiveDprPref,
  type ImmersiveFramebufferScalePref,
  type ImmersiveFoveationPref,
  type ImmersiveFrameRate,
} from "../xr";
import type { MmdVrFrameRatePref, MmdVrPrefs, MmdVrRenderQuality } from "./mmdVrStore";

export type { MmdVrRenderQuality };

export type MmdVrRenderProfile = {
  quality: MmdVrRenderQuality;
  dpr: number | [number, number];
  antialias: boolean;
  floorSegments: number;
  frameRate: ImmersiveFrameRate;
  shadows: boolean;
  showGrid: boolean;
  walkSpeed: number;
  framebufferScale: number;
  foveation: number;
  shadowMapSize: number;
  targetFrameRateHz: number | null;
};

const FRAME_RATE_TARGETS: Record<Exclude<MmdVrFrameRatePref, "auto">, number> = {
  "72": 72,
  "80": 80,
  "90": 90,
  "120": 120,
};

export function resolveMmdVrFrameRate(pref: MmdVrFrameRatePref, fallback: MmdVrRenderProfile["frameRate"]) {
  if (pref === "auto") return fallback;
  const target = FRAME_RATE_TARGETS[pref];
  return (supported: ArrayLike<number>) => {
    const sorted = Array.from(supported).sort((a, b) => a - b);
    return [...sorted].reverse().find((rate) => rate <= target) ?? sorted[0] ?? false;
  };
}

const PROFILES: Record<MmdVrRenderQuality, MmdVrRenderProfile> = {
  high: {
    quality: "high",
    dpr: [1, 1.25],
    antialias: true,
    floorSegments: 48,
    frameRate: "high",
    shadows: true,
    showGrid: true,
    walkSpeed: 1.35,
    framebufferScale: 1,
    foveation: 0.25,
    shadowMapSize: 2048,
    targetFrameRateHz: null,
  },
  balanced: {
    quality: "balanced",
    dpr: 1,
    antialias: false,
    floorSegments: 32,
    frameRate: "mid",
    shadows: false,
    showGrid: true,
    walkSpeed: 1.15,
    framebufferScale: 0.85,
    foveation: 0.5,
    shadowMapSize: 1024,
    targetFrameRateHz: null,
  },
  low: {
    quality: "low",
    dpr: 1,
    antialias: false,
    floorSegments: 20,
    frameRate: "low",
    shadows: false,
    showGrid: false,
    walkSpeed: 1.0,
    framebufferScale: 0.7,
    foveation: 1,
    shadowMapSize: 512,
    targetFrameRateHz: null,
  },
};

const WALK_MAP = {
  slow: 0.85,
  normal: 1.15,
  fast: 1.55,
} as const;

const SHADOW_MAP_SIZE = { low: 512, medium: 1024, high: 2048 } as const;

export type MmdVrQualityInput = Pick<
  MmdVrPrefs,
  | "renderQuality"
  | "dprPref"
  | "frameRatePref"
  | "antialiasPref"
  | "shadowsPref"
  | "gridPref"
  | "walkSpeedPref"
  | "framebufferScalePref"
  | "foveationPref"
  | "shadowResolutionPref"
  | "advancedRenderOverrides"
>;

export function getMmdVrRenderProfile(
  qualityOrPrefs: MmdVrRenderQuality | MmdVrQualityInput,
): MmdVrRenderProfile {
  const quality =
    typeof qualityOrPrefs === "string" ? qualityOrPrefs : qualityOrPrefs.renderQuality;
  let base = { ...(PROFILES[quality] ?? PROFILES.balanced) };

  if (typeof qualityOrPrefs === "string") return base;

  const { dprPref, frameRatePref, antialiasPref, shadowsPref, gridPref, walkSpeedPref, framebufferScalePref, foveationPref, shadowResolutionPref } =
    qualityOrPrefs;

  base = applyCommonQualityAxes(base, {
    dprPref: dprPref as ImmersiveDprPref,
    antialiasPref: antialiasPref as ImmersiveAntialiasPref,
    framebufferScalePref: qualityOrPrefs.advancedRenderOverrides
      ? framebufferScalePref as ImmersiveFramebufferScalePref
      : "auto",
    foveationPref: qualityOrPrefs.advancedRenderOverrides
      ? foveationPref as ImmersiveFoveationPref
      : "auto",
  });
  base.frameRate = resolveMmdVrFrameRate(frameRatePref, base.frameRate) as MmdVrRenderProfile["frameRate"];
  base.targetFrameRateHz = frameRatePref === "auto" ? null : FRAME_RATE_TARGETS[frameRatePref];

  if (shadowsPref === "on") base.shadows = true;
  if (shadowsPref === "off") base.shadows = false;
  if (gridPref === "on") base.showGrid = true;
  if (gridPref === "off") base.showGrid = false;
  if (walkSpeedPref && walkSpeedPref !== "auto") {
    base.walkSpeed = WALK_MAP[walkSpeedPref] ?? base.walkSpeed;
  }
  if (shadowResolutionPref && shadowResolutionPref !== "auto") {
    base.shadowMapSize = SHADOW_MAP_SIZE[shadowResolutionPref] ?? base.shadowMapSize;
  }

  return base;
}

export function formatMmdVrProfileSummary(
  profile: MmdVrRenderProfile,
  language: "zh" | "en",
): string {
  const dpr = formatDprLabel(profile.dpr);
  const aa = formatOnOff(profile.antialias, language);
  const sh = formatOnOff(profile.shadows, language);
  const gr = formatOnOff(profile.showGrid, language);
  const fps = profile.targetFrameRateHz == null ? formatFrameRateLabel(profile.frameRate) : `${profile.targetFrameRateHz} Hz`;
  if (language === "zh") {
    return `DPR ${dpr} · AA ${aa} · 阴影 ${sh} · 网格 ${gr} · 走速 ${profile.walkSpeed.toFixed(2)} · 目标 ${fps}`;
  }
  return `DPR ${dpr} · AA ${aa} · shadows ${sh} · grid ${gr} · walk ${profile.walkSpeed.toFixed(2)} · target ${fps}`;
}
