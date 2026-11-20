import { beforeEach, describe, expect, it, vi } from "vitest";
import { beginMmdVrSessionFromClick, endMmdVrSession, waitForMmdVrPresentation } from "./mmdVrSession";
import { useMmdVrStore } from "./mmdVrStore";
import { requestMmdVrEnter } from "./requestMmdVrEnter";
import { getXrDiagnostics, getXrSystem } from "../xr/xrDetect";
import { beginMmdVrAssetSession, endMmdVrAssetSession, getMmdVrSessionAssets, peekMmdVrPendingAssets, setMmdVrPendingAssets } from "./mmdVrAssets";
import { clearBackpack, syncBackpackFiles, useBackpack } from "./backpack";
import type { StageSnapshot } from "./stageSnapshot";

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
    endMmdVrSession: vi.fn(async () => {}),
    waitForMmdVrPresentation: vi.fn(async () => ({ id: "mmd-s1" })),
  };
});

describe("requestMmdVrEnter", () => {
  const t = (k: string) => k;
  const addNotification = vi.fn();

  beforeEach(() => {
    useMmdVrStore.setState({ savedStage: null, resumeStage: null, captureStage: null });
    vi.mocked(endMmdVrSession).mockClear();
    vi.mocked(waitForMmdVrPresentation).mockReset();
    vi.mocked(waitForMmdVrPresentation).mockResolvedValue({ id: "mmd-s1" } as unknown as XRSession);
    endMmdVrAssetSession();
    clearBackpack();
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
        movementMode: 'normal',
        lightPreset: "stage",
        framebufferScalePref: "auto",
        foveationPref: "auto",
        shadowResolutionPref: "auto",
        viewDistance: 40,
        snapTurnDegrees: 30,
        exposure: 1,
        stageSkyEnabled: true,
        showSceneryPeople: true,
        scenery: "floor",
        softHighlights: false,
        balancedModelColor: true,
        stageFogEnabled: true,
        stageRimLightEnabled: false,
        stageLightPoolEnabled: false,
        handTracking: true,
        advancedRenderOverrides: false,
        detailedPhysicsDiagnostics: false,
        panelFollowUser: true,
        physicsColliderRadius: 0.08,
        physicsColliderFriction: "medium",
        physicsColliderRestitution: "none",
        physicsHapticLevel: "low",
        actorPalmCloth: false,
        chestCompression:true,
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
    expect(useMmdVrStore.getState().errorMessage).toBe("settingsVrDesktopNeedHttps");
  });

  it("exposes a rejected XR session and allows a clean retry", async () => {
    vi.mocked(beginMmdVrSessionFromClick).mockRejectedValueOnce(new Error("permission denied"));
    const result = await requestMmdVrEnter({ t: t as never, addNotification });
    expect(result).toBe("failed");
    expect(endMmdVrSession).toHaveBeenCalledOnce();
    expect(useMmdVrStore.getState()).toMatchObject({ overlayOpen: false, phase: "error" });
    expect(useMmdVrStore.getState().errorMessage).toContain("permission denied");
    await expect(requestMmdVrEnter({ t: t as never, addNotification })).resolves.toBe("entered");
  });

  it("requests XR in the original click stack", async () => {
    const entering = requestMmdVrEnter({ t: t as never, addNotification });
    expect(beginMmdVrSessionFromClick).toHaveBeenCalledOnce();
    await entering;
  });

  it("does not reopen the overlay or overwrite a newer entry after cancellation", async () => {
    let resolveFrame!: (value: XRSession) => void;
    vi.mocked(waitForMmdVrPresentation).mockReturnValueOnce(new Promise((resolve) => { resolveFrame = resolve; }));
    const entering = requestMmdVrEnter({ t: t as never, addNotification });
    await Promise.resolve();
    useMmdVrStore.getState().closeOverlay();
    resolveFrame({} as XRSession);
    await expect(entering).resolves.toBe("failed");
    expect(useMmdVrStore.getState().overlayOpen).toBe(false);
    expect(addNotification).not.toHaveBeenCalled();
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
    expect(useMmdVrStore.getState().phase).toBe("active");
  });

  it("stays entering until an XR frame, not just requestSession", async () => {
    let firstFrame!: (session: XRSession) => void;
    vi.mocked(waitForMmdVrPresentation).mockReturnValueOnce(new Promise((resolve) => { firstFrame = resolve; }));
    const entering = requestMmdVrEnter({ t: t as never, addNotification });
    await vi.waitFor(() => expect(waitForMmdVrPresentation).toHaveBeenCalledOnce());
    expect(useMmdVrStore.getState().phase).toBe("entering");
    firstFrame({ id: "mmd-s1" } as unknown as XRSession);
    await expect(entering).resolves.toBe("entered");
    expect(useMmdVrStore.getState().phase).toBe("active");
  });

  it("times out a stalled first frame and closes the failed entry", async () => {
    vi.useFakeTimers();
    vi.mocked(waitForMmdVrPresentation).mockReturnValueOnce(new Promise(() => {}));
    try {
      const entering = requestMmdVrEnter({ t: t as never, addNotification });
      await vi.advanceTimersByTimeAsync(20_001);
      await expect(entering).resolves.toBe("failed");
      expect(useMmdVrStore.getState()).toMatchObject({ overlayOpen: false, phase: "error" });
      expect(useMmdVrStore.getState().errorMessage).toContain("first frame");
      expect(endMmdVrSession).toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it("cancels a never-resolving request without waiting for browser permission", async () => {
    vi.mocked(beginMmdVrSessionFromClick).mockReturnValueOnce(new Promise(() => {}));
    const entering = requestMmdVrEnter({ t: t as never, addNotification });
    useMmdVrStore.getState().closeOverlay();
    await expect(entering).resolves.toBe("failed");
    expect(waitForMmdVrPresentation).not.toHaveBeenCalled();
    expect(addNotification).not.toHaveBeenCalled();
  });

  it("restores only saved instances and scenery on continue, then opens a fresh empty stage on the same page", async () => {
    const file = new File(["saved"], "saved.pmx"), spare = new File(["unused"], "unused.glb");
    syncBackpackFiles([file, spare]);
    const saved: StageSnapshot = { assets: [{ kind: "model", modelFile: file, companionFiles: [file], bodyMotionFile: null }],
      scenery: "classroom", models: [], objects: [], time: 10, playing: false, loop: true, physicsEnabled: false, controllerCollisions: true };
    useMmdVrStore.setState({ savedStage: saved });
    useBackpack.setState({ layouts: { classroom: saved } });
    const entering = requestMmdVrEnter({ t: t as never, addNotification, resume: true, assets: [] });
    expect(beginMmdVrSessionFromClick).toHaveBeenCalledOnce();
    expect(getMmdVrSessionAssets()).toHaveLength(1);
    expect(getMmdVrSessionAssets()[0]).toMatchObject({ modelFile: file });
    expect(useMmdVrStore.getState().resumeStage).toBe(saved);
    expect(useMmdVrStore.getState().prefs.scenery).toBe("classroom");
    expect(useBackpack.getState().layouts.classroom).toBe(saved);
    await entering;
    useMmdVrStore.getState().closeOverlay();
    // An old session and the deprecated pending-slot handoff must both be overwritten by [].
    beginMmdVrAssetSession(saved.assets);
    setMmdVrPendingAssets(saved.assets);
    await requestMmdVrEnter({ t: t as never, addNotification });
    beginMmdVrAssetSession(); // Simulate a consumer attaching on remount.
    expect(useMmdVrStore.getState().resumeStage).toBeNull();
    expect(getMmdVrSessionAssets()).toEqual([]);
    expect(peekMmdVrPendingAssets()).toEqual([]);
    expect(useBackpack.getState().layouts).toEqual({});
    expect(useBackpack.getState().files).toEqual([file, spare]);
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
