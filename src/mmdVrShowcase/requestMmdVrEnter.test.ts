import { beforeEach, describe, expect, it, vi } from "vitest";
import { beginMmdVrSessionFromClick } from "./mmdVrSession";
import { useMmdVrStore } from "./mmdVrStore";
import { requestMmdVrEnter } from "./requestMmdVrEnter";
import { getXrDiagnostics, getXrSystem } from "../xr/xrDetect";
import { endMmdVrAssetSession, getMmdVrSessionAssets } from "./mmdVrAssets";

vi.mock("../xr/xrDetect", async () => {
  const actual = await vi.importActual<typeof import("../xr/xrDetect")>("../xr/xrDetect");
  return {
    ...actual,
    getXrSystem: vi.fn(() => ({ requestSession: vi.fn() })),
    getXrDiagnostics: vi.fn(() => ({
      secure: true,
      hasXr: true,
      protocol: "https:",
      host: "example.com",
      summary: "secure=true xr=true https://example.com",
    })),
  };
});

vi.mock("./mmdVrSession", async () => {
  const actual = await vi.importActual<typeof import("./mmdVrSession")>("./mmdVrSession");
  return {
    ...actual,
    beginMmdVrSessionFromClick: vi.fn(async () => ({ id: "mmd-s1" })),
  };
});

vi.mock("./preloadMmdVrScene", () => ({
  preloadMmdVrScene: vi.fn(() => Promise.resolve()),
}));

describe("requestMmdVrEnter", () => {
  const t = (k: string) => k;
  const addNotification = vi.fn();

  beforeEach(() => {
    endMmdVrAssetSession();
    addNotification.mockClear();
    vi.mocked(beginMmdVrSessionFromClick).mockClear();
    vi.mocked(beginMmdVrSessionFromClick).mockResolvedValue({ id: "mmd-s1" } as unknown as XRSession);
    vi.mocked(getXrSystem).mockReturnValue({ requestSession: vi.fn() } as unknown as XRSystem);
    vi.mocked(getXrDiagnostics).mockReturnValue({
      secure: true,
      hasXr: true,
      protocol: "https:",
      host: "example.com",
      summary: "secure=true xr=true https://example.com",
    });
    useMmdVrStore.setState({
      prefs: {
        renderQuality: "balanced",
        showFps: false,
        loop: true,
        dprPref: "auto",
        frameRatePref: "auto",
        antialiasPref: "auto",
        shadowsPref: "auto",
        gridPref: "auto",
        walkSpeedPref: "auto",
        lightPreset: "stage",
        framebufferScalePref: "auto",
        foveationPref: "auto",
        shadowResolutionPref: "auto",
        heightOffset: 0,
        viewDistance: 40,
        snapTurnDegrees: 30,
        exposure: 1,
        stageSkyEnabled: true,
        stageFogEnabled: true,
        stageRimLightEnabled: false,
        stageLightPoolEnabled: false,
        handTracking: true,
        advancedRenderOverrides: false,
        detailedPhysicsDiagnostics: false,
        panelFollowUser: true,
        physicsColliderRadius: 0.08,
        physicsQuality: "medium",
        physicsBoneFeedback: "normal",
        physicsColliderFriction: "medium",
        physicsColliderRestitution: "none",
        physicsHapticLevel: "low",
        physicsDynamicSelfCollision: false,
      },
      phase: "idle",
      errorMessage: null,
      lastError: null,
      overlayOpen: false,
      playing: false,
      loop: true,
      statusLine: null,
      modelCount: 0,
      models: [],
      materialModels: {},
      runtimeRef: null,
      materialPanelModelId: null,
      pendingVisibilityToggles: [],
      duration: 0,
      seekEpoch: 0,
      seekSeconds: 0,
      viewEpoch: 0,
    });
  });

  it("fails without secure context", async () => {
    vi.mocked(getXrDiagnostics).mockReturnValue({
      secure: false,
      hasXr: false,
      protocol: "http:",
      host: "192.168.1.1",
      summary: "secure=false",
    });
    const result = await requestMmdVrEnter({ t: t as never, addNotification });
    expect(result).toBe("failed");
    expect(beginMmdVrSessionFromClick).not.toHaveBeenCalled();
  });

  it("fails when self is already busy", async () => {
    useMmdVrStore.setState({ overlayOpen: true, phase: "active" });
    const result = await requestMmdVrEnter({ t: t as never, addNotification });
    expect(result).toBe("failed");
    expect(beginMmdVrSessionFromClick).not.toHaveBeenCalled();
  });

  it("enters when secure and WebXR present", async () => {
    const result = await requestMmdVrEnter({ t: t as never, addNotification });
    expect(result).toBe("entered");
    expect(beginMmdVrSessionFromClick).toHaveBeenCalledOnce();
    expect(useMmdVrStore.getState().overlayOpen).toBe(true);
  });

  it("commits every model before the XR session resolves", async () => {
    let resolveSession!: (session: XRSession) => void;
    vi.mocked(beginMmdVrSessionFromClick).mockReturnValue(new Promise((resolve) => {
      resolveSession = resolve;
    }));
    const assets = ["a.pmx", "b.pmx", "c.pmx"].map((name) => {
      const file = new File([name], name);
      return { kind: "model" as const, modelFile: file, companionFiles: [file], bodyMotionFile: null };
    });

    const entering = requestMmdVrEnter({ t: t as never, addNotification, assets });

    expect(useMmdVrStore.getState().overlayOpen).toBe(true);
    expect(getMmdVrSessionAssets().map((slot) => slot.kind === "model" ? slot.modelFile.name : "")).toEqual([
      "a.pmx",
      "b.pmx",
      "c.pmx",
    ]);

    resolveSession({ id: "mmd-s1" } as unknown as XRSession);
    await expect(entering).resolves.toBe("entered");
  });
});
