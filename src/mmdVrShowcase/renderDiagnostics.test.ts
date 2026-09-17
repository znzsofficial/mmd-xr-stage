import { describe, expect, it, vi } from "vitest";
import type { WebGLRenderer } from "three";
import { createFrameCadence, describeRenderRequest, readRenderDiagnostics, type RenderRequest } from "./renderDiagnostics";
import { normalizeMmdVrPrefs } from "./mmdVrStore";
import { diagnosticLines } from "./diagnosticText";
import { en } from "../i18n/en";

const requested: RenderRequest = { frameRate: "120 Hz", antialias: true, framebufferScale: 1, foveation: 0.5 };
function renderer(layer: object | null, options: { active?: boolean; frameRate?: number; samples?: number; isXrTarget?: boolean } = {}) {
  return {
    xr: {
      isPresenting: options.active !== false,
      getSession: () => options.active === false ? null : { frameRate: options.frameRate },
      getBaseLayer: vi.fn(() => layer),
    },
    getRenderTarget: () => ({ samples: options.samples, isXRRenderTarget: options.isXrTarget !== false }),
    getContext: () => ({ getContextAttributes: () => ({ antialias: true }) }),
  } as unknown as WebGLRenderer;
}

describe("XR render diagnostics", () => {
  it("keeps the request distinct from the reported session rate and measured cadence", () => {
    const data = readRenderDiagnostics(renderer({ textureWidth: 3664, textureHeight: 1920, fixedFoveation: 0.25 }, { frameRate: 90, samples: 4 }), requested, { fps: 87, frameIntervalMs: 11.5 });
    expect(data).toMatchObject({ requested: { frameRate: "120 Hz", foveation: 0.5 }, refreshRate: 90, fps: 87,
      frameIntervalMs: 11.5, layer: "projection", width: 3664, height: 1920, targetSamples: 4, layerAntialias: null, foveation: 0.25 });
  });

  it("does not use renderer AA or presets to fabricate missing XR readings", () => {
    const data = readRenderDiagnostics(renderer({ textureWidth: 1000, textureHeight: 1000 }, { isXrTarget: false, samples: 4 }), requested, null);
    expect(data).toMatchObject({ contextAntialias: true, layerAntialias: null, targetSamples: null, foveation: null, refreshRate: null, fps: null });
    expect(diagnosticLines(data, (key) => en[key], "en").join("\n")).toContain("Not reported");
  });

  it("uses legacy XRWebGLLayer antialias rather than misleading render-target samples", () => {
    const data = readRenderDiagnostics(renderer({ framebufferWidth: 2048, framebufferHeight: 1024, antialias: false, fixedFoveation: 0 }, { samples: 0 }), requested, null);
    expect(data).toMatchObject({ layer: "webgl", layerAntialias: false, targetSamples: null, foveation: 0 });
  });

  it("discards session metrics after exit and does not read a stale layer", () => {
    const gl = renderer({ textureWidth: 1000 }, { active: false, frameRate: 90 });
    const data = readRenderDiagnostics(gl, requested, { fps: 90, frameIntervalMs: 11.1 });
    expect(data).toMatchObject({ active: false, layer: "unknown", refreshRate: null, fps: null, width: null });
    expect(gl.xr.getBaseLayer).not.toHaveBeenCalled();
    expect(diagnosticLines(data, (key) => en[key], "en")).toEqual([en.diagWaiting]);
  });

  it("reports runtime defaults when experimental framebuffer overrides were not applied", () => {
    const prefs = normalizeMmdVrPrefs({ framebufferScalePref: "1", foveationPref: "off", advancedRenderOverrides: false });
    expect(describeRenderRequest(prefs)).toMatchObject({ framebufferScale: null, foveation: null });
    expect(describeRenderRequest({ ...prefs, advancedRenderOverrides: true })).toMatchObject({ framebufferScale: 1, foveation: 0 });
  });

  it("samples on a bounded cadence and resets after tracking interruptions", () => {
    const meter = createFrameCadence();
    for (let i = 0; i < 59; i++) expect(meter.sample(1 / 60)).toBeNull();
    expect(meter.sample(1 / 60)).toEqual({ fps: 60, frameIntervalMs: 16.7 });
    meter.sample(0.25);
    expect(meter.sample(4)).toBeNull();
    for (let i = 0; i < 3; i++) expect(meter.sample(0.25)).toBeNull();
    expect(meter.sample(0.25)).toEqual({ fps: 4, frameIntervalMs: 250 });
    meter.reset();
    expect(meter.sample(NaN)).toBeNull();
  });
});
