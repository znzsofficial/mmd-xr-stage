import type { Matrix4 } from 'three';
import { createBodyDisplay } from '../bodyState/runtime';
import type { PoseSolver } from '../pose/poseSolver';
import type { WardrobeModel } from '../wardrobe/model';
import { fitChestCompression } from './chestCompression';
import { beginFingertipFit } from './fingertipIndent';
import { applyMorphOverrides, type RuntimeEntry } from './mmdRuntimeEntry';
import type { PhysicsPoseDisplay } from './physicsPoseDisplay';
import { fitPoseSkirt } from './poseSkirtClearance';
import { FINGERTIP_MASK, TrackedPressure } from './trackedPressure';

export type ActorDisplayEntry = RuntimeEntry & {
  editor?: PoseSolver;
  poseSkirt?: ReturnType<typeof fitPoseSkirt>;
  chest?: ReturnType<typeof fitChestCompression>;
  bodyDisplay?: ReturnType<typeof createBodyDisplay>;
  wardrobe?: WardrobeModel;
  fingertipFit?: ReturnType<typeof beginFingertipFit>;
  fingertip?: ReturnType<ReturnType<typeof beginFingertipFit>>;
  trackedPressure?: TrackedPressure;
  displayHands: { mask: number; colliders?: () => readonly Matrix4[]; radius?: () => number };
  physicsDisplay?: PhysicsPoseDisplay;
};

export function bodyDisplay(entry: ActorDisplayEntry) {
  if (entry.chest === undefined) entry.chest = fitChestCompression(entry.model.mesh);
  return entry.bodyDisplay ??= createBodyDisplay(entry.model.mesh, entry.chest);
}

function restoreBodyLayers(entry: ActorDisplayEntry) {
  entry.chest?.restore();
  entry.bodyDisplay?.restore();
  entry.wardrobe?.restore();
}

export function restorePoseBeforeFrame(entry: ActorDisplayEntry, physicsOn: boolean, reset: boolean, reseed: boolean) {
  if (!physicsOn || reset || !entry.editor) entry.poseSkirt?.clear();
  else entry.poseSkirt?.restore();
  restoreBodyLayers(entry);
  if (!physicsOn || reset || reseed) entry.fingertip?.reset();
  else entry.fingertip?.restore();
  entry.physicsDisplay?.restore(!physicsOn || reset);
}

// A new evaluator or explicit physics reset must not inherit any filter history.
export function clearPoseForRebind(entry: ActorDisplayEntry) {
  entry.poseSkirt?.clear();
  restoreBodyLayers(entry);
  entry.chest?.reset();
  entry.fingertip?.reset();
  entry.physicsDisplay?.restore(true);
}

export function restoreHiddenPose(entry: ActorDisplayEntry) {
  entry.fingertip?.reset();
  entry.chest?.restore();
  entry.chest?.reset();
  entry.bodyDisplay?.restore();
  entry.wardrobe?.restore();
}

export function releaseRemovedPose(entry: ActorDisplayEntry) {
  entry.fingertip?.reset();
  entry.chest?.restore();
  entry.bodyDisplay?.restore();
  entry.fingertip = null;
  entry.fingertipFit = undefined;
  // Wardrobe restoration belongs to model disposal, after the backend is released.
}

export function seedEditedSkirt(entry: ActorDisplayEntry) {
  if (entry.poseSkirt === undefined) entry.poseSkirt = fitPoseSkirt(entry.model.mesh);
  entry.poseSkirt?.seed();
  entry.poseSkirt?.present();
}

// Called only after a successful evaluation, with the visual model scale restored.
export function presentEvaluatedPose(entry: ActorDisplayEntry, seconds: number, physicsDelta: number | undefined,
  prevSeconds: number | undefined, physicsOn: boolean, resetPressure: boolean, dancePressure: boolean) {
  const { mask, colliders, radius } = entry.displayHands;
  const handMask = physicsOn ? mask : 0;
  applyMorphOverrides(entry);
  entry.wardrobe?.present();
  let bodyBonesChanged = entry.bodyDisplay?.apply() ?? false;
  const bodyParams = entry.bodyDisplay?.settings;

  // Continue the release even after tracking drops out. Controller-only VR needs no surface query.
  if (dancePressure || handMask || (physicsOn && entry.trackedPressure)) {
    if (entry.chest === undefined) entry.chest = fitChestCompression(entry.model.mesh);
    if (entry.chest && handMask && colliders) {
      entry.trackedPressure ??= new TrackedPressure();
      entry.trackedPressure.prepare(colliders(), handMask, radius?.() ?? .033);
      if ((handMask & FINGERTIP_MASK) && entry.fingertip === undefined) {
        entry.fingertipFit ??= beginFingertipFit(entry.model.mesh, entry.chest.affectedBones, entry.chest.width);
        entry.fingertip = entry.fingertipFit();
        if (entry.fingertip !== undefined) entry.fingertipFit = undefined;
      }
    } else if (entry.trackedPressure) entry.trackedPressure.mask = 0;

    // Blend with the last surface sample, then fit the fingertip on this frame's final bone pose.
    if (entry.chest?.apply(seconds, physicsDelta, resetPressure, dancePressure, entry.trackedPressure,
      entry.fingertip?.tipBroadGain, bodyParams?.compression, bodyParams?.rebound)) bodyBonesChanged = true;
    if (physicsOn && bodyParams?.compression !== 0) {
      entry.fingertip?.apply(entry.trackedPressure, physicsDelta ?? Math.max(0, seconds - (prevSeconds ?? seconds)),
        bodyParams?.compression, bodyParams?.rebound);
    } else if (bodyParams?.compression === 0) entry.fingertip?.reset();
  } else entry.chest?.reset();
  if (bodyBonesChanged) entry.model.mesh.skeleton.update();
  if (physicsOn && entry.editor) entry.poseSkirt?.present();
}
