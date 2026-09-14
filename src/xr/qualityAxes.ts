/** Shared immersive quality axes (desktop + MMD). Product-specific knobs stay local. */

export type ImmersiveRenderQuality = "high" | "balanced" | "low";
export type ImmersiveDprPref = "auto" | "1" | "1.25" | "1.5";
export type ImmersiveFrameRatePref = "auto" | "high" | "mid" | "low";
export type ImmersiveAntialiasPref = "auto" | "on" | "off";
export type ImmersiveTogglePref = "auto" | "on" | "off";
export type ImmersiveFramebufferScalePref = "auto" | "0.7" | "0.85" | "1";
export type ImmersiveFoveationPref = "auto" | "off" | "medium" | "high";
export type ImmersiveFrameRate = "high" | "mid" | "low" | false | ((supported: ArrayLike<number>) => number | false);

export const IMMERSIVE_DPR_MAP: Record<
  Exclude<ImmersiveDprPref, "auto">,
  number | [number, number]
> = {
  "1": 1,
  "1.25": [1, 1.25],
  "1.5": [1, 1.5],
};

export type CommonQualityAxes = {
  dpr: number | [number, number];
  antialias: boolean;
  frameRate: ImmersiveFrameRate;
  framebufferScale: number;
  foveation: number;
};

export type CommonQualityPrefs = {
  dprPref?: ImmersiveDprPref;
  frameRatePref?: ImmersiveFrameRatePref;
  antialiasPref?: ImmersiveAntialiasPref;
  framebufferScalePref?: ImmersiveFramebufferScalePref;
  foveationPref?: ImmersiveFoveationPref;
};

const FRAMEBUFFER_SCALE_MAP: Record<Exclude<ImmersiveFramebufferScalePref, "auto">, number> = {
  "0.7": 0.7,
  "0.85": 0.85,
  "1": 1,
};

const FOVEATION_MAP: Record<Exclude<ImmersiveFoveationPref, "auto">, number> = {
  off: 0,
  medium: 0.5,
  high: 1,
};

/** Mutates a copy of base with shared axis overrides. */
export function applyCommonQualityAxes<T extends CommonQualityAxes>(
  base: T,
  prefs: CommonQualityPrefs,
): T {
  const next = { ...base };
  if (prefs.dprPref && prefs.dprPref !== "auto") {
    next.dpr = IMMERSIVE_DPR_MAP[prefs.dprPref] ?? next.dpr;
  }
  if (prefs.frameRatePref && prefs.frameRatePref !== "auto") {
    next.frameRate = prefs.frameRatePref;
  }
  if (prefs.antialiasPref === "on") next.antialias = true;
  if (prefs.antialiasPref === "off") next.antialias = false;
  if (prefs.framebufferScalePref && prefs.framebufferScalePref !== "auto") {
    next.framebufferScale = FRAMEBUFFER_SCALE_MAP[prefs.framebufferScalePref] ?? next.framebufferScale;
  }
  if (prefs.foveationPref && prefs.foveationPref !== "auto") {
    next.foveation = FOVEATION_MAP[prefs.foveationPref] ?? next.foveation;
  }
  return next;
}

export function formatDprLabel(dpr: number | [number, number]): string {
  return typeof dpr === "number" ? String(dpr) : `${dpr[0]}–${dpr[1]}`;
}

export function formatFrameRateLabel(frameRate: ImmersiveFrameRate): string {
  if (typeof frameRate === "function") return "custom";
  if (frameRate === false) return "—";
  if (frameRate === "high") return "72+";
  if (frameRate === "mid") return "~60";
  return "~45";
}

export function formatOnOff(on: boolean, language: "zh" | "en"): string {
  if (language === "zh") return on ? "开" : "关";
  return on ? "on" : "off";
}

export function scalePanelSize(base: number, scale: number): number {
  const n = Math.max(64, Math.round(base * scale));
  return n % 2 === 0 ? n : n + 1;
}

export function normalizeImmersiveQuality(value: unknown): ImmersiveRenderQuality {
  if (value === "high" || value === "balanced" || value === "low") return value;
  return "balanced";
}

export function normalizeImmersiveDpr(value: unknown): ImmersiveDprPref {
  if (value === "auto" || value === "1" || value === "1.25" || value === "1.5") return value;
  return "auto";
}

export function normalizeImmersiveFrameRate(value: unknown): ImmersiveFrameRatePref {
  if (value === "auto" || value === "high" || value === "mid" || value === "low") return value;
  return "auto";
}

export function normalizeImmersiveAntialias(value: unknown): ImmersiveAntialiasPref {
  if (value === "auto" || value === "on" || value === "off") return value;
  return "auto";
}

export function normalizeImmersiveToggle(value: unknown): ImmersiveTogglePref {
  if (value === "auto" || value === "on" || value === "off") return value;
  return "auto";
}

export function normalizeImmersiveFramebufferScale(value: unknown): ImmersiveFramebufferScalePref {
  if (value === "auto" || value === "0.7" || value === "0.85" || value === "1") return value;
  return "auto";
}

export function normalizeImmersiveFoveation(value: unknown): ImmersiveFoveationPref {
  if (value === "auto" || value === "off" || value === "medium" || value === "high") return value;
  return "auto";
}
