import type { MmdVrAssetSlot } from "../backpack/sessionAssets";
import type { MmdModelTransform } from "../mmdRuntime/mmdRuntimeEntry";
import {DEFAULT_MATERIAL_OVERRIDE,type MaterialOverride} from "../mmdRuntime/mmdRuntimeMaterials";
import type { MmdRuntimeHandle } from "../mmdRuntime/mmdRuntime";
import type { Object3D } from "three";
import type { SceneryId } from "../scenery/catalog";

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
  scenery?: SceneryId;
  assets: MmdVrAssetSlot[];
  models: SavedModel[];
  objects: SavedObject[];
  time: number;
  playing: boolean;
  loop: boolean;
  physicsEnabled: boolean;
  /** Older in-memory layouts can carry this flag. Contact now follows XR physics. */
  controllerCollisions?: boolean;
};

export function snapshotObject(file: File, group: Object3D): SavedObject {
  return { file, position: group.position.toArray(), quaternion: group.quaternion.toArray(), scale: group.scale.toArray(), visible: group.visible };
}

export function snapshotModel(model: SavedModel): SavedModel {
  return { ...model, transform: { ...model.transform }, materialVisible: { ...model.materialVisible },
    materialOverrides: Object.fromEntries(Object.entries(model.materialOverrides).map(([name, override]) => [name, { ...override }])) };
}

export function restoreStageTime(saved: number, duration: number) {
  return Number.isFinite(saved) ? Math.min(Math.max(0, saved), Math.max(0, duration)) : 0;
}

/** Only called on a newly loaded instance whose initial appearance is already applied. */
export function applySavedModel(runtime: Pick<MmdRuntimeHandle, "setModelVisible" | "setMaterialVisible" | "setMaterialOverride">, modelId: string, saved: SavedModel) {
  if(!saved.visible)runtime.setModelVisible(modelId,false);
  for (const [name, visible] of Object.entries(saved.materialVisible)) if(!visible)runtime.setMaterialVisible(modelId,name,false);
  for (const [name, override] of Object.entries(saved.materialOverrides)) {
    const patch=Object.fromEntries(Object.entries(override).filter(([key,v])=>v!==DEFAULT_MATERIAL_OVERRIDE[key as keyof MaterialOverride]));
    if(Object.keys(patch).length)runtime.setMaterialOverride(modelId,name,patch);
  }
}

export function applySavedObject(group: Object3D, saved: SavedObject) {
  group.position.fromArray(saved.position);
  group.quaternion.fromArray(saved.quaternion);
  group.scale.fromArray(saved.scale);
  group.visible = saved.visible;
}
