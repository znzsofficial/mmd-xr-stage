// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MmdVrDiagnostics } from "./MmdVrDiagnostics";
import { useRenderDiagnostics } from "../renderDiagnostics";

const harness = vi.hoisted(() => ({ frame: (_state: unknown, _delta: number) => {}, gl: {} as unknown }));
vi.mock("@react-three/fiber", () => ({
  useThree: (selector: (state: { gl: unknown }) => unknown) => selector({ gl: harness.gl }),
  useFrame: (callback: typeof harness.frame) => { harness.frame = callback; },
}));
afterEach(() => { vi.unstubAllGlobals(); useRenderDiagnostics.getState().set(null); });

describe("XR diagnostic sampling lifecycle", () => {
  it("clears stale readings on visibility loss, session replacement and unmount", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    let session: { frameRate: number; visibilityState: string } | null = { frameRate: 90, visibilityState: "visible" };
    harness.gl = {
      xr: { isPresenting: true, getSession: () => session, getBaseLayer: () => ({ framebufferWidth: 2000, framebufferHeight: 1000, antialias: true }) },
      getRenderTarget: () => null,
      getContext: () => ({ getContextAttributes: () => ({ antialias: true }) }),
    };
    const element = document.createElement("div");
    const root = createRoot(element);
    try {
      await act(async () => root.render(<MmdVrDiagnostics requested={{ frameRate: "120 Hz", antialias: true, framebufferScale: null, foveation: null }} />));
      for (let i = 0; i < 4; i++) harness.frame(null, 0.25);
      expect(useRenderDiagnostics.getState().current).toMatchObject({ refreshRate: 90, fps: 4 });
      session.visibilityState = "hidden";
      harness.frame(null, 0.25);
      expect(useRenderDiagnostics.getState().current?.fps).toBeNull();
      session = { frameRate: 72, visibilityState: "visible" };
      harness.frame(null, 0.01);
      expect(useRenderDiagnostics.getState().current).toMatchObject({ refreshRate: 72, fps: null });
      session = null;
      harness.frame(null, 0.01);
      expect(useRenderDiagnostics.getState().current).toMatchObject({ active: false, refreshRate: null });
    } finally { await act(async () => root.unmount()); }
    expect(useRenderDiagnostics.getState().current).toBeNull();
  });
});
