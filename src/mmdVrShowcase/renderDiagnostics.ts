import { create } from "zustand";
import type { WebGLRenderer } from "three";
import { getMmdVrRenderProfile, type MmdVrQualityInput } from "./mmdVrQuality";

export type RenderRequest = {
  frameRate: string;
  antialias: boolean;
  framebufferScale: number | null;
  foveation: number | null;
};
export type RenderDiagnostics = {
  requested: RenderRequest;
  active: boolean;
  refreshRate: number | null;
  fps: number | null;
  frameIntervalMs: number | null;
  layer: "projection" | "webgl" | "unknown";
  width: number | null;
  height: number | null;
  layerAntialias: boolean | null;
  targetSamples: number | null;
  contextAntialias: boolean | null;
  foveation: number | null;
};

export function describeRenderRequest(prefs: MmdVrQualityInput): RenderRequest {
  const profile = getMmdVrRenderProfile(prefs);
  return {
    frameRate: profile.targetFrameRateHz == null ? String(profile.frameRate) : `${profile.targetFrameRateHz} Hz`,
    antialias: profile.antialias,
    framebufferScale: prefs.advancedRenderOverrides ? profile.framebufferScale : null,
    foveation: prefs.advancedRenderOverrides ? profile.foveation : null,
  };
}

type DiagnosticLayer = {
  textureWidth?: number;
  textureHeight?: number;
  framebufferWidth?: number;
  framebufferHeight?: number;
  antialias?: boolean;
  fixedFoveation?: number | null;
};

const positive = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;

/** Layer reports and target configuration are intentionally separate from measured frame cadence. */
export function readRenderDiagnostics(
  renderer: Pick<WebGLRenderer, "xr" | "getRenderTarget" | "getContext">,
  requested: RenderRequest,
  cadence: { fps: number; frameIntervalMs: number } | null,
): RenderDiagnostics {
  const session = renderer.xr.getSession();
  const active = Boolean(session && renderer.xr.isPresenting);
  const layer = (active ? renderer.xr.getBaseLayer() : null) as DiagnosticLayer | null;
  const kind = layer && "textureWidth" in layer ? "projection" : layer && "framebufferWidth" in layer ? "webgl" : "unknown";
  const target = active ? renderer.getRenderTarget() : null;
  const isXrTarget = Boolean((target as { isXRRenderTarget?: boolean } | null)?.isXRRenderTarget);
  const samples = kind === "projection" && isXrTarget && typeof target?.samples === "number" && Number.isFinite(target.samples) && target.samples >= 0 ? target.samples : null;
  const foveation = layer?.fixedFoveation;
  return {
    requested, active,
    refreshRate: active ? positive(session?.frameRate) : null,
    fps: active ? cadence?.fps ?? null : null,
    frameIntervalMs: active ? cadence?.frameIntervalMs ?? null : null,
    layer: kind,
    width: positive(kind === "projection" ? layer?.textureWidth : layer?.framebufferWidth),
    height: positive(kind === "projection" ? layer?.textureHeight : layer?.framebufferHeight),
    layerAntialias: kind === "webgl" && typeof layer?.antialias === "boolean" ? layer.antialias : null,
    targetSamples: samples,
    contextAntialias: renderer.getContext().getContextAttributes()?.antialias ?? null,
    foveation: typeof foveation === "number" && Number.isFinite(foveation) ? foveation : null,
  };
}

export function createFrameCadence() {
  let elapsed = 0;
  let frames = 0;
  return {
    reset() { elapsed = 0; frames = 0; },
    sample(delta: number) {
      if (!Number.isFinite(delta) || delta <= 0 || delta > 0.5) { elapsed = 0; frames = 0; return null; }
      elapsed += delta;
      frames += 1;
      if (elapsed < 1) return null;
      const result = { fps: Math.round(frames / elapsed), frameIntervalMs: Math.round(elapsed / frames * 10000) / 10 };
      elapsed = 0;
      frames = 0;
      return result;
    },
  };
}

export const useRenderDiagnostics = create<{ current: RenderDiagnostics | null; set: (current: RenderDiagnostics | null) => void }>((set) => ({
  current: null,
  set: (current) => set({ current }),
}));
