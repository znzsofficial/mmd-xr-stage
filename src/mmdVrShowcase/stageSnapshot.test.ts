import { beforeEach, describe, expect, it, vi } from "vitest";
import { snapshotModel, restoreStageTime, applySavedModel, applySavedObject, type StageSnapshot } from "./stageSnapshot";
import { Group } from "three";
import { useMmdVrStore } from "./mmdVrStore";
import { emptyAssetLoadProgress } from "./mmdAssetLoadQueue";
import { DEFAULT_MODEL_TRANSFORM } from "./mmdRuntime/mmdRuntimeEntry";
import { DEFAULT_MATERIAL_OVERRIDE } from "./mmdRuntime/mmdRuntimeMaterials";

const file = new File(["pmx"], "model.pmx");
function stage(): StageSnapshot {
  return { assets: [{ kind: "model", modelFile: file, companionFiles: [file], bodyMotionFile: null }],
    models: [{ file, transform: { ...DEFAULT_MODEL_TRANSFORM, scale: 0.2, positionX: 3 }, visible: false,
      materialVisible: { hair: false }, materialOverrides: { hair: { ...DEFAULT_MATERIAL_OVERRIDE, opacity: 0.4 } } }],
    objects: [], time: 36, playing: false, loop: false, physicsEnabled: true, controllerCollisions: false };
}

beforeEach(() => useMmdVrStore.setState({ savedStage: null, resumeStage: null, captureStage: null, assetLoad: emptyAssetLoadProgress(), physicsBusy: false }));

describe("same-page stage resume", () => {
  it("copies mutable transform/material data while retaining the original File", () => {
    const original = stage().models[0];
    const saved = snapshotModel(original);
    original.transform.scale = 4;
    original.materialVisible.hair = true;
    original.materialOverrides.hair.opacity = 1;
    expect(saved.transform.scale).toBe(0.2);
    expect(saved.materialVisible.hair).toBe(false);
    expect(saved.materialOverrides.hair.opacity).toBe(0.4);
    expect(saved.file).toBe(file);
  });

  it("captures before session reset and resumes only on explicit continue", () => {
    const store = useMmdVrStore.getState();
    store.openOverlay();
    const capture = vi.fn(() => stage());
    store.setStageCapture(capture);
    store.closeOverlay();
    expect(capture).toHaveBeenCalledOnce();
    expect(useMmdVrStore.getState()).toMatchObject({ playing: false, captureStage: null, savedStage: { time: 36 } });
    store.prepareStage(true);
    expect(useMmdVrStore.getState().resumeStage?.models[0].file).toBe(file);
    store.prepareStage(false);
    expect(useMmdVrStore.getState().resumeStage).toBeNull();
  });

  it("preserves the previous stage if a new entry is cancelled before assets finish", () => {
    useMmdVrStore.setState({ savedStage: stage(), captureStage: () => null });
    useMmdVrStore.getState().closeOverlay();
    expect(useMmdVrStore.getState().savedStage?.time).toBe(36);
  });

  it("preserves the complete A+B snapshot after B fails to restore, then updates after retry succeeds", () => {
    const saved = stage();
    const second = new File(["B"], "B.pmx");
    saved.assets.push({ kind: "model", modelFile: second, companionFiles: [second], bodyMotionFile: null });
    const capture = vi.fn(() => stage());
    useMmdVrStore.setState({ savedStage: saved, captureStage: capture, assetLoad: { ...emptyAssetLoadProgress(), completed: 2, total: 2,
      failures: [{ id: "b", fileName: "B.pmx", phase: "model", message: "decode failed" }] } });
    useMmdVrStore.getState().closeOverlay();
    expect(capture).not.toHaveBeenCalled();
    expect(useMmdVrStore.getState().savedStage).toBe(saved);
    expect(useMmdVrStore.getState().savedStage?.assets).toHaveLength(2);
    useMmdVrStore.setState({ captureStage: capture, assetLoad: emptyAssetLoadProgress() });
    useMmdVrStore.getState().closeOverlay();
    expect(capture).toHaveBeenCalledOnce();
    expect(useMmdVrStore.getState().savedStage).not.toBe(saved);
  });

  it("clamps playback time to the newly loaded duration", () => {
    expect(restoreStageTime(36, 20)).toBe(20);
    expect(restoreStageTime(-1, 20)).toBe(0);
    expect(restoreStageTime(NaN, 20)).toBe(0);
  });

  it("replays visibility and material overrides using the new runtime model id", () => {
    const runtime = { setModelVisible: vi.fn(), setMaterialVisible: vi.fn(), setMaterialOverride: vi.fn() };
    const saved = stage().models[0];
    applySavedModel(runtime, "new-runtime-id", saved);
    expect(runtime.setModelVisible).toHaveBeenCalledWith("new-runtime-id", false);
    expect(runtime.setMaterialVisible).toHaveBeenCalledWith("new-runtime-id", "hair", false);
    expect(runtime.setMaterialOverride).toHaveBeenCalledWith("new-runtime-id", "hair", expect.objectContaining({ opacity: 0.4 }));
    const group = new Group();
    applySavedObject(group, { file, position: [1, 2, -3], quaternion: [0, 1, 0, 0], scale: [0.2, 0.3, 0.4], visible: false });
    expect(group.position.toArray()).toEqual([1, 2, -3]);
    expect(group.quaternion.toArray()).toEqual([0, 1, 0, 0]);
    expect(group.scale.toArray()).toEqual([0.2, 0.3, 0.4]);
    expect(group.visible).toBe(false);
  });
});
