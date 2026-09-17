import type { MmdVrAssetSlot } from "./mmdVrAssets";
import type { MmdModelTransform } from "./mmdRuntime/mmdRuntimeEntry";
import type { MaterialOverride } from "./mmdRuntime/mmdRuntimeMaterials";
import type { MmdRuntimeHandle } from "./mmdRuntime/mmdRuntime";
import type { Object3D } from "three";

export type SavedModel = {
  file: File;
  transform: MmdModelTransform;
  visible: boolean;
  materialVisible: Record<string, boolean>;
  materialOverrides: Record<string, MaterialOverride>;
};
export type SavedObject = {
  file: File;
  position: [number, number, number];
  quaternion: [number, number, number, number];
  scale: [number, number, number];
  visible: boolean;
};
export type StageSnapshot = {
  assets: MmdVrAssetSlot[];
  models: SavedModel[];
  objects: SavedObject[];
  time: number;
  playing: boolean;
  loop: boolean;
  physicsEnabled: boolean;
  controllerCollisions: boolean;
};

export function snapshotModel(model: SavedModel): SavedModel {
  return { ...model, transform: { ...model.transform }, materialVisible: { ...model.materialVisible },
    materialOverrides: Object.fromEntries(Object.entries(model.materialOverrides).map(([name, override]) => [name, { ...override }])) };
}

export function restoreStageTime(saved: number, duration: number) {
  return Number.isFinite(saved) ? Math.min(Math.max(0, saved), Math.max(0, duration)) : 0;
}

export function applySavedModel(runtime: Pick<MmdRuntimeHandle, "setModelVisible" | "setMaterialVisible" | "setMaterialOverride">, modelId: string, saved: SavedModel) {
  runtime.setModelVisible(modelId, saved.visible);
  for (const [name, visible] of Object.entries(saved.materialVisible)) runtime.setMaterialVisible(modelId, name, visible);
  for (const [name, override] of Object.entries(saved.materialOverrides)) runtime.setMaterialOverride(modelId, name, override);
}

export function applySavedObject(group: Object3D, saved: SavedObject) {
  group.position.fromArray(saved.position);
  group.quaternion.fromArray(saved.quaternion);
  group.scale.fromArray(saved.scale);
  group.visible = saved.visible;
}
