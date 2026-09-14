import { beforeEach, describe, expect, it } from "vitest";
import {
  normalizeMmdVrFrameRate,
  normalizeMmdVrHeightOffset,
  normalizeMmdVrModelScale,
  normalizeMmdVrPrefs,
  useMmdVrStore,
} from "./mmdVrStore";
import {
  fineTuneMmdVrModelScale,
  mmdVrHeightOffsetToSlider,
  mmdVrModelScaleToSlider,
  mmdVrSliderToHeightOffset,
  mmdVrSliderToModelScale,
  mmdVrSliderToViewDistance,
  mmdVrViewDistanceToSlider,
  nextMmdVrModelScale,
  previousMmdVrModelScale,
} from "./mmdVrAdjustments";

describe("MMD VR adjustments", () => {
  beforeEach(() => {
    useMmdVrStore.setState({
      models: [{ id: "model-1", name: "Miku.pmx", visible: true, scale: 1, rotationY: 0 }],
      modelCount: 1,
      placeModelId: "model-1",
      pendingModelTransforms: [],
      pendingModelRemovals: [],
    });
  });

  it("clamps model scale and user height", () => {
    expect(normalizeMmdVrModelScale(0.001)).toBe(0.01);
    expect(normalizeMmdVrModelScale(12)).toBe(10);
    expect(normalizeMmdVrHeightOffset(-6)).toBe(-5);
    expect(normalizeMmdVrHeightOffset(51)).toBe(50);
    expect(normalizeMmdVrPrefs({ viewDistance: 2 }).viewDistance).toBe(10);
    expect(normalizeMmdVrPrefs({ viewDistance: 120 }).viewDistance).toBe(100);
    expect(normalizeMmdVrPrefs().physicsDynamicSelfCollision).toBe(false);
    expect(normalizeMmdVrPrefs({ physicsDynamicSelfCollision: true }).physicsDynamicSelfCollision).toBe(true);
    expect(normalizeMmdVrPrefs().handTracking).toBe(true);
    expect(normalizeMmdVrPrefs({ handTracking: false }).handTracking).toBe(false);
    expect(normalizeMmdVrPrefs()).toMatchObject({
      stageSkyEnabled: true,
      stageFogEnabled: true,
      stageRimLightEnabled: false,
      stageLightPoolEnabled: false,
    });
    expect(normalizeMmdVrPrefs({ stageFogEnabled: false, stageRimLightEnabled: false })).toMatchObject({
      stageFogEnabled: false,
      stageRimLightEnabled: false,
    });
    for (const lightPreset of ["soft", "contrast", "daylight", "warm", "rim"] as const) {
      expect(normalizeMmdVrPrefs({ lightPreset })).toMatchObject({
        stageRimLightEnabled: true,
        stageLightPoolEnabled: true,
      });
    }
    expect(normalizeMmdVrPrefs({
      lightPreset: "rim",
      stageRimLightEnabled: false,
      stageLightPoolEnabled: true,
    })).toMatchObject({
      stageRimLightEnabled: false,
      stageLightPoolEnabled: true,
    });
    expect(normalizeMmdVrPrefs({ snapTurnDegrees: 45, exposure: 2 })).toMatchObject({
      snapTurnDegrees: 45,
      exposure: 1.3,
    });
  });

  it("migrates legacy frame-rate tiers to explicit Quest refresh rates", () => {
    expect(normalizeMmdVrFrameRate("low")).toBe("72");
    expect(normalizeMmdVrFrameRate("mid")).toBe("90");
    expect(normalizeMmdVrFrameRate("high")).toBe("120");
  });

  it("uses useful nonlinear scale steps at very small and normal sizes", () => {
    expect(previousMmdVrModelScale(1)).toBe(0.8);
    expect(nextMmdVrModelScale(1)).toBe(1.25);
    expect(previousMmdVrModelScale(0.1)).toBe(0.075);
    expect(nextMmdVrModelScale(0.1)).toBe(0.15);
  });

  it("maps the continuous sliders across their complete ranges", () => {
    expect(mmdVrSliderToModelScale(0)).toBe(0.01);
    expect(mmdVrSliderToModelScale(1)).toBe(10);
    expect(mmdVrModelScaleToSlider(1)).toBeCloseTo(2 / 3);
    expect(mmdVrSliderToHeightOffset(0)).toBe(-5);
    expect(mmdVrSliderToHeightOffset(1)).toBe(50);
    expect(mmdVrHeightOffsetToSlider(0)).toBeCloseTo(1 / 11);
    expect(fineTuneMmdVrModelScale(1, -1)).toBe(0.952);
    expect(fineTuneMmdVrModelScale(1, 1)).toBe(1.05);
    expect(mmdVrSliderToViewDistance(0)).toBe(10);
    expect(mmdVrSliderToViewDistance(1)).toBe(100);
    expect(mmdVrViewDistanceToSlider(40)).toBeCloseTo(1 / 3);
  });

  it("updates the displayed model scale and keeps only the latest request", () => {
    const store = useMmdVrStore.getState();
    store.requestModelScale("model-1", 1.1);
    useMmdVrStore.getState().requestModelScale("model-1", 1.2);

    expect(useMmdVrStore.getState().models[0].scale).toBe(1.2);
    expect(useMmdVrStore.getState().takeModelTransformRequests()).toEqual([
      { id: "model-1", scale: 1.2 },
    ]);
    expect(useMmdVrStore.getState().pendingModelTransforms).toEqual([]);
  });

  it("queues rotation and full reset requests per model", () => {
    const store = useMmdVrStore.getState();
    store.requestModelRotation("model-1", -15);
    useMmdVrStore.getState().requestModelScale("model-1", 1.5);

    expect(useMmdVrStore.getState().models[0]).toMatchObject({ rotationY: 345, scale: 1.5 });
    expect(useMmdVrStore.getState().takeModelTransformRequests()).toEqual([
      { id: "model-1", rotationY: 345, scale: 1.5 },
    ]);

    useMmdVrStore.getState().requestModelReset("model-1");
    expect(useMmdVrStore.getState().models[0]).toMatchObject({ rotationY: 0, scale: 1 });
    expect(useMmdVrStore.getState().takeModelTransformRequests()).toEqual([
      { id: "model-1", reset: true },
    ]);

    useMmdVrStore.getState().requestModelReset("model-1");
    useMmdVrStore.getState().requestModelRotation("model-1", 15);
    expect(useMmdVrStore.getState().takeModelTransformRequests()).toEqual([
      { id: "model-1", reset: true, rotationY: 15 },
    ]);
  });

  it("queues each existing model for removal once", () => {
    const store = useMmdVrStore.getState();
    store.enqueueModelRemoval("model-1");
    useMmdVrStore.getState().enqueueModelRemoval("model-1");
    useMmdVrStore.getState().enqueueModelRemoval("missing");

    expect(useMmdVrStore.getState().takeModelRemovals()).toEqual(["model-1"]);
    expect(useMmdVrStore.getState().takeModelRemovals()).toEqual([]);
  });

  it("applies object transforms through the shared id queues", () => {
    useMmdVrStore.setState({
      objects: [{ id: "object:chair.glb", name: "chair", visible: true, scale: 1, rotationY: 0 }],
    });
    const store = useMmdVrStore.getState();
    store.requestModelScale("object:chair.glb", 2);
    useMmdVrStore.getState().requestModelRotation("object:chair.glb", 90);

    expect(useMmdVrStore.getState().objects[0]).toMatchObject({ scale: 2, rotationY: 90 });
    expect(useMmdVrStore.getState().takeModelTransformRequests()).toEqual([
      { id: "object:chair.glb", scale: 2, rotationY: 90 },
    ]);

    useMmdVrStore.getState().requestModelReset("object:chair.glb");
    expect(useMmdVrStore.getState().objects[0]).toMatchObject({ scale: 1, rotationY: 0 });
    expect(useMmdVrStore.getState().takeModelTransformRequests()).toEqual([
      { id: "object:chair.glb", reset: true },
    ]);
  });

  it("queues objects for removal and picks objects for placement", () => {
    useMmdVrStore.setState({
      objects: [{ id: "object:table.glb", name: "table", visible: true, scale: 1, rotationY: 0 }],
      models: [],
      modelCount: 0,
    });
    const store = useMmdVrStore.getState();
    store.enqueueModelRemoval("object:table.glb");
    expect(useMmdVrStore.getState().takeModelRemovals()).toEqual(["object:table.glb"]);

    useMmdVrStore.getState().setPlaceMode(true);
    expect(useMmdVrStore.getState().placeModelId).toBe("object:table.glb");
    useMmdVrStore.getState().setPlaceMode(false);
  });

  it("cycles through all six lighting modes", () => {
    useMmdVrStore.getState().setPrefs({ lightPreset: "stage" });
    const seen = [useMmdVrStore.getState().prefs.lightPreset];
    for (let index = 0; index < 5; index += 1) {
      useMmdVrStore.getState().cycleLightPreset();
      seen.push(useMmdVrStore.getState().prefs.lightPreset);
    }

    expect(seen).toEqual(["stage", "soft", "daylight", "warm", "rim", "contrast"]);
    useMmdVrStore.getState().cycleLightPreset();
    expect(useMmdVrStore.getState().prefs.lightPreset).toBe("stage");
  });

  it("keeps experimental physics session-only and off after exit", () => {
    useMmdVrStore.getState().setPhysicsEnabled(true);
    useMmdVrStore.getState().setPhysicsDebugEnabled(true);
    useMmdVrStore.getState().setPhysicsBusy(true);
    useMmdVrStore.getState().setPhysicsError("failed", true);

    useMmdVrStore.getState().closeOverlay();

    expect(useMmdVrStore.getState()).toMatchObject({
      physicsEnabled: false,
      physicsDebugEnabled: false,
      physicsBusy: false,
      physicsError: null,
      physicsFatal: false,
    });
  });

  it("clears physics diagnostics when debug display is disabled", () => {
    useMmdVrStore.setState({
      physicsDebugEnabled: true,
      physicsContactCount: 2,
      physicsControllerContactCounts: [1, 0],
      physicsDynamicBodyCount: 12,
      physicsRigidBodyCount: 20,
      physicsStepCount: 30,
    });

    useMmdVrStore.getState().setPhysicsDebugEnabled(false);

    expect(useMmdVrStore.getState()).toMatchObject({
      physicsDebugEnabled: false,
      physicsContactCount: 0,
      physicsControllerContactCounts: [0, 0],
      physicsDynamicBodyCount: 0,
      physicsRigidBodyCount: 0,
      physicsStepCount: 0,
    });
  });

  it("cycles session physics controls and restores defaults after exit", () => {
    const store = useMmdVrStore.getState();
    store.cyclePhysicsColliderRadius();
    useMmdVrStore.getState().cyclePhysicsQuality();
    useMmdVrStore.getState().setPhysicsControllerCollisions(false);
    useMmdVrStore.getState().cyclePhysicsHapticLevel();
    useMmdVrStore.getState().requestPhysicsReset();

    expect(useMmdVrStore.getState()).toMatchObject({
      prefs: { physicsColliderRadius: 0.12, physicsQuality: "high" },
      physicsControllerCollisions: false,
      physicsResetEpoch: 1,
    });
    expect(useMmdVrStore.getState().prefs.physicsHapticLevel).toBe("normal");

    useMmdVrStore.getState().closeOverlay();

    // Session-only fields reset; prefs fields persist.
    expect(useMmdVrStore.getState()).toMatchObject({
      prefs: { physicsColliderRadius: 0.12, physicsQuality: "high" },
      physicsControllerCollisions: true,
      physicsResetEpoch: 0,
    });
    expect(useMmdVrStore.getState().prefs.physicsHapticLevel).toBe("normal");

    // Restore prefs defaults for subsequent tests.
    useMmdVrStore.getState().setPrefs({
      physicsColliderRadius: 0.08,
      physicsQuality: "medium",
      physicsHapticLevel: "low",
      physicsDynamicSelfCollision: false,
    });
  });

  it("cycles physics tuning tiers and persists across exit", () => {
    const store = useMmdVrStore.getState();
    store.cyclePhysicsBoneFeedback();
    useMmdVrStore.getState().cyclePhysicsColliderFriction();
    useMmdVrStore.getState().cyclePhysicsColliderRestitution();

    expect(useMmdVrStore.getState().prefs).toMatchObject({
      physicsBoneFeedback: "hard",
      physicsColliderFriction: "high",
      physicsColliderRestitution: "low",
    });

    useMmdVrStore.getState().closeOverlay();

    // Prefs persist across session exit.
    expect(useMmdVrStore.getState().prefs).toMatchObject({
      physicsBoneFeedback: "hard",
      physicsColliderFriction: "high",
      physicsColliderRestitution: "low",
    });

    // Restore prefs defaults for subsequent tests.
    useMmdVrStore.getState().setPrefs({
      physicsBoneFeedback: "normal",
      physicsColliderFriction: "medium",
      physicsColliderRestitution: "none",
    });
  });

  it("clears material state for removed models", () => {
    const store = useMmdVrStore.getState();
    store.setMaterialModels({
      "model-1": [{ name: "Body", visible: true, opacity: 1, roughness: 0.55, metallic: 0, emission: 0 }],
    });
    store.setMaterialPanelModelId("model-1");

    useMmdVrStore.getState().setMaterialModels({});

    expect(useMmdVrStore.getState().materialModels).toEqual({});
    expect(useMmdVrStore.getState().materialPanelModelId).toBeNull();
  });

  it("forwards clamped material emission to the runtime and panel state", () => {
    const calls: unknown[] = [];
    useMmdVrStore.setState({
      materialModels: {
        "model-1": [{ name: "Body", visible: true, opacity: 1, roughness: 0.55, metallic: 0, emission: 0 }],
      },
      runtimeRef: {
        setMaterialVisible: () => undefined,
        setMaterialOverride: (...args) => calls.push(args),
      },
    });

    useMmdVrStore.getState().setMaterialParam("model-1", "Body", "emission", 3);

    expect(calls).toEqual([["model-1", "Body", { emission: 2 }]]);
    expect(useMmdVrStore.getState().materialModels["model-1"]?.[0]?.emission).toBe(2);

    useMmdVrStore.getState().setMaterialParam("model-1", "Body", "emission", Number.NaN);
    expect(useMmdVrStore.getState().materialModels["model-1"]?.[0]?.emission).toBe(0);
  });
});
