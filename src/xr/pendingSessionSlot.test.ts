import { afterEach, describe, expect, it, vi } from "vitest";
import { createPendingSessionSlot } from "./pendingSessionSlot";

function withXr(session: XRSession) {
  const xr = {
    requestSession: vi.fn().mockResolvedValue(session),
  };
  const originalXr = (globalThis as { navigator?: { xr?: unknown } }).navigator?.xr;
  const g = globalThis as typeof globalThis & {
    navigator: { xr?: unknown };
    isSecureContext?: boolean;
    window?: { isSecureContext?: boolean };
  };
  if (!g.navigator) {
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { xr } });
  } else {
    Object.defineProperty(g.navigator, "xr", { configurable: true, value: xr });
  }
  Object.defineProperty(globalThis, "isSecureContext", { configurable: true, value: true });
  // pendingSessionSlot checks typeof window !== "undefined" && !window.isSecureContext
  if (typeof (globalThis as { window?: unknown }).window === "undefined") {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { isSecureContext: true },
    });
  } else {
    Object.defineProperty(g.window as object, "isSecureContext", {
      configurable: true,
      value: true,
    });
  }
  return () => {
    if (g.navigator) {
      Object.defineProperty(g.navigator, "xr", { configurable: true, value: originalXr });
    }
  };
}

describe("createPendingSessionSlot", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps pending after successful attach for remount re-bind", async () => {
    const slot = createPendingSessionSlot();
    const session = {
      addEventListener: vi.fn(),
      end: vi.fn(),
    } as unknown as XRSession;

    const restore = withXr(session);
    try {
      await slot.beginFromClick();
      expect(slot.peek()).toBe(session);

      const setSession = vi.fn().mockResolvedValue(undefined);
      const gl = {
        xr: { setSession, enabled: false, isPresenting: false },
      } as unknown as import("three").WebGLRenderer;

      const onAttached = vi.fn();
      await expect(slot.attachToRenderer(gl, onAttached)).resolves.toBe(true);
      expect(setSession).toHaveBeenCalledWith(session);
      expect(onAttached).toHaveBeenCalledOnce();
      expect(slot.peek()).toBe(session);
    } finally {
      restore();
    }
  });

  it("serializes concurrent attaches", async () => {
    const slot = createPendingSessionSlot();
    const session = {
      addEventListener: vi.fn(),
      end: vi.fn(),
    } as unknown as XRSession;
    const restore = withXr(session);
    try {
      await slot.beginFromClick();

      let release!: () => void;
      const gate = new Promise<void>((r) => {
        release = r;
      });
      const order: string[] = [];
      const setSession = vi.fn().mockImplementation(async () => {
        order.push("start");
        await gate;
        order.push("end");
      });
      const gl = {
        xr: { setSession, enabled: false, isPresenting: false },
      } as unknown as import("three").WebGLRenderer;

      const a = slot.attachToRenderer(gl);
      const b = slot.attachToRenderer(gl);
      release();
      await Promise.all([a, b]);
      expect(setSession).toHaveBeenCalledTimes(2);
      expect(order).toEqual(["start", "end", "start", "end"]);
    } finally {
      restore();
    }
  });
});
