import { afterEach, describe, expect, it, vi } from "vitest";
import { createProductXrSession } from "./createProductXrSession";

function withXr() {
  const requestSession = vi.fn<XRSystem["requestSession"]>().mockResolvedValue({
    addEventListener: vi.fn(),
    end: vi.fn(),
  } as unknown as XRSession);
  const xr = { requestSession };
  const g = globalThis as typeof globalThis & {
    navigator: { xr?: unknown };
    isSecureContext?: boolean;
    window?: { isSecureContext?: boolean };
  };
  const originalXr = g.navigator?.xr;
  if (!g.navigator) {
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { xr } });
  } else {
    Object.defineProperty(g.navigator, "xr", { configurable: true, value: xr });
  }
  Object.defineProperty(globalThis, "isSecureContext", { configurable: true, value: true });
  if (typeof g.window === "undefined") {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { isSecureContext: true },
    });
  } else {
    Object.defineProperty(g.window, "isSecureContext", { configurable: true, value: true });
  }
  return {
    requestSession,
    restore: () => {
      if (g.navigator) {
        Object.defineProperty(g.navigator, "xr", { configurable: true, value: originalXr });
      }
    },
  };
}

describe("createProductXrSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forwards the session init to requestSession", async () => {
    const { requestSession, restore } = withXr();
    const session = createProductXrSession({
      resolveFrameRate: () => "mid",
    });
    try {
      const init: XRSessionInit = {
        requiredFeatures: ["local-floor"],
        optionalFeatures: ["hand-tracking"],
      };
      await session.beginFromClick(init);
      expect(requestSession).toHaveBeenCalledWith("immersive-vr", init);
    } finally {
      restore();
    }
  });

  it("falls back to the default init when none is provided", async () => {
    const { requestSession, restore } = withXr();
    const session = createProductXrSession({
      resolveFrameRate: () => "mid",
    });
    try {
      await session.beginFromClick();
      const [, init] = requestSession.mock.calls[0];
      expect(init?.requiredFeatures).toEqual(["local-floor"]);
      expect(init?.optionalFeatures).not.toContain("hand-tracking");
    } finally {
      restore();
    }
  });
});
