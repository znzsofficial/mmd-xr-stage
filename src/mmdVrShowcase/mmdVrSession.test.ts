import { afterEach, describe, expect, it, vi } from "vitest";
import { attachPendingMmdVrSessionToRenderer, beginMmdVrSessionFromClick, endMmdVrSession } from "./mmdVrSession";
import { normalizeMmdVrPrefs } from "./mmdVrStore";

describe("MMD VR session", () => {
  afterEach(async () => {
    await endMmdVrSession();
    vi.unstubAllGlobals();
  });

  it("attaches without changing renderer XR quality before setSession", async () => {
    const session = {
      addEventListener: vi.fn(),
      end: vi.fn().mockResolvedValue(undefined),
    } as unknown as XRSession;
    vi.stubGlobal("navigator", {
      xr: { requestSession: vi.fn().mockResolvedValue(session) },
    });
    vi.stubGlobal("isSecureContext", true);

    await beginMmdVrSessionFromClick();

    const setSession = vi.fn().mockResolvedValue(undefined);
    const setFramebufferScaleFactor = vi.fn();
    const setFoveation = vi.fn();
    const renderer = {
      xr: {
        enabled: false,
        isPresenting: false,
        setSession,
        setFramebufferScaleFactor,
        setFoveation,
      },
    };

    await attachPendingMmdVrSessionToRenderer(renderer as never, "balanced");

    expect(setSession).toHaveBeenCalledWith(session);
    expect(setFramebufferScaleFactor).not.toHaveBeenCalled();
    expect(setFoveation).not.toHaveBeenCalled();
  });

  it("applies renderer overrides only after explicit opt-in", async () => {
    const xrSession = {
      addEventListener: vi.fn(),
      end: vi.fn().mockResolvedValue(undefined),
    } as unknown as XRSession;
    vi.stubGlobal("navigator", { xr: { requestSession: vi.fn().mockResolvedValue(xrSession) } });
    vi.stubGlobal("isSecureContext", true);
    await beginMmdVrSessionFromClick();

    const setFramebufferScaleFactor = vi.fn();
    const setFoveation = vi.fn();
    const renderer = {
      xr: {
        enabled: false,
        isPresenting: false,
        setSession: vi.fn().mockResolvedValue(undefined),
        setFramebufferScaleFactor,
        setFoveation,
      },
    };
    const prefs = normalizeMmdVrPrefs({
      advancedRenderOverrides: true,
      framebufferScalePref: "0.7",
      foveationPref: "high",
    });

    await attachPendingMmdVrSessionToRenderer(renderer as never, prefs);

    expect(setFramebufferScaleFactor).toHaveBeenCalledWith(0.7);
    expect(setFoveation).toHaveBeenCalledWith(1);
  });
});
