// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { WebGLRenderer } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AttachPendingXrSession } from "./AttachPendingXrSession";
import { createPendingSessionSlot } from "./pendingSessionSlot";

const harness = vi.hoisted(() => ({
  gl: null as unknown as WebGLRenderer,
  frame: null as null | ((state: unknown, delta: number, frame?: XRFrame) => void),
}));
vi.mock("@react-three/fiber", () => ({
  useThree: (selector: (state: { gl: WebGLRenderer }) => unknown) => selector({ gl: harness.gl }),
  useFrame: (frame: typeof harness.frame) => { harness.frame = frame; },
}));
vi.mock("@react-three/xr", () => ({ useXR: () => null }));

afterEach(() => vi.unstubAllGlobals());

describe("XR Canvas attachment", () => {
  it("survives StrictMode's effect replay during a cold request and requires the real XR frame", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("isSecureContext", true);
    let resolve!: (session: XRSession) => void;
    vi.stubGlobal("navigator", { xr: { requestSession: () => new Promise<XRSession>((done) => { resolve = done; }) } });
    const session = Object.assign(new EventTarget(), { end: vi.fn(async () => {}) }) as unknown as XRSession;
    const xr = { enabled: false, isPresenting: false, getSession: () => session,
      setSession: vi.fn(async () => { xr.isPresenting = true; }) };
    harness.gl = { xr } as unknown as WebGLRenderer;
    const slot = createPendingSessionSlot();
    const creating = slot.beginFromClick();
    const host = document.createElement("div");
    const root = createRoot(host);
    const fail = vi.fn();
    const attach = (gl: WebGLRenderer, signal: AbortSignal) => slot.attachToRenderer(gl, undefined, { signal });
    try {
      await act(async () => root.render(<StrictMode><AttachPendingXrSession attach={attach} markFrame={slot.markFrame} isCurrent={() => true} onFail={fail} /></StrictMode>));
      expect(xr.setSession).not.toHaveBeenCalled();
      await act(async () => { resolve(session); await creating; });
      expect(xr.setSession).toHaveBeenCalledOnce();
      expect(slot.getSnapshot().phase).toBe("bound");
      harness.frame?.({}, 1 / 60);
      expect(slot.getSnapshot().phase).toBe("bound");
      harness.frame?.({}, 1 / 90, { session } as XRFrame);
      await expect(slot.waitForPresentation()).resolves.toBe(session);
      expect(fail).not.toHaveBeenCalled();
      expect(session.end).not.toHaveBeenCalled();
    } finally {
      await act(async () => root.unmount());
      await slot.end();
    }
  });

  it("reports a rejected binding once instead of silently exhausting retries", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const root = createRoot(document.createElement("div"));
    const fail = vi.fn();
    const attach = vi.fn(async () => { throw new Error("XR framebuffer failed"); });
    try {
      await act(async () => root.render(<StrictMode><AttachPendingXrSession attach={attach} markFrame={() => false} isCurrent={() => true} onFail={fail} /></StrictMode>));
      expect(fail).toHaveBeenCalledExactlyOnceWith("XR framebuffer failed");
    } finally { await act(async () => root.unmount()); }
  });
});
