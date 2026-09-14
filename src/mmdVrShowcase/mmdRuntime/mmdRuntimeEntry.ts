import {
  disposeMmdModel,
  type MmdAnimation,
  type ThreeMmdAnimation,
  type ThreeMmdModel,
} from "@yohawing/three-mmd-loader";
import * as THREE from "three";
import { disposeEntryEnhancementTextures, type MaterialOverride } from "./mmdRuntimeMaterials";
import { getMmdAnimationDurationSeconds, mergeMotionAnimations } from "./mmdUtils";

export type MmdModelTransform = {
  positionX: number;
  positionY: number;
  positionZ: number;
  /** degrees */
  rotationX: number;
  /** degrees */
  rotationY: number;
  /** degrees */
  rotationZ: number;
  scale: number;
};

export const DEFAULT_MODEL_TRANSFORM: MmdModelTransform = Object.freeze({
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  scale: 1,
});

export function cloneTransform(t: MmdModelTransform = DEFAULT_MODEL_TRANSFORM): MmdModelTransform {
  return {
    positionX: t.positionX,
    positionY: t.positionY,
    positionZ: t.positionZ,
    rotationX: t.rotationX,
    rotationY: t.rotationY,
    rotationZ: t.rotationZ,
    scale: t.scale,
  };
}

export type RuntimeEntry = {
  id: string;
  name: string;
  model: ThreeMmdModel;
  bodyAnimation: ThreeMmdAnimation | null;
  faceAnimation: ThreeMmdAnimation | null;
  cameraAnimation: ThreeMmdAnimation | null;
  appliedAnimation: ThreeMmdAnimation | null;
  bodyMotionName: string | null;
  faceMotionName: string | null;
  cameraMotionName: string | null;
  bodyMotionFile: File | null;
  faceMotionFile: File | null;
  cameraMotionFile: File | null;
  visible: boolean;
  morphNames: string[];
  materialNames: string[];
  morphWeights: Record<string, number>;
  morphFavorites: string[];
  materialVisible: Record<string, boolean>;
  materialOverrides: Record<string, MaterialOverride>;
  transform: MmdModelTransform;
  /** Viewport gizmo is driving root TRS; update() must not stomp pos/rot. */
  gizmoLock?: boolean;
  hasCameraTrack: boolean;
  duration: number;
  modelFile: File;
  companionFiles: File[];
};

export type RuntimeModelSnapshot = {
  id: string;
  name: string;
  visible: boolean;
  morphNames: string[];
  materialNames: string[];
  bodyMotionName: string | null;
  faceMotionName: string | null;
  cameraMotionName: string | null;
  morphWeights: Record<string, number>;
  morphFavorites: string[];
  materialVisible: Record<string, boolean>;
  materialOverrides: Record<string, MaterialOverride>;
  transform: MmdModelTransform;
  hasCameraTrack: boolean;
  duration: number;
};

export function extractMorphNames(model: ThreeMmdModel) {
  const dict = model.mesh.morphTargetDictionary ?? {};
  return Object.keys(dict).sort((a, b) => a.localeCompare(b, "zh"));
}

export function extractMaterialNames(model: ThreeMmdModel) {
  const materials = Array.isArray(model.mesh.material) ? model.mesh.material : [model.mesh.material];
  return materials.map((material, index) => {
    const named = material?.name?.trim();
    return named || `Material ${index + 1}`;
  });
}

export function disposeModelObject(entry: RuntimeEntry) {
  disposeEntryEnhancementTextures(entry);
  disposeLoadedModelObject(entry.model);
}

export function disposeLoadedModelObject(model: ThreeMmdModel) {
  disposeMmdModel(model, { textures: "owned" });
}

function disableMmdSelfShadowUniforms(material: THREE.Material) {
  const factors = material.userData?.mmdMaterialFactorShader as
    | { uniforms?: { mmdSelfShadowReceive?: { value: number } } }
    | undefined;
  if (factors?.uniforms?.mmdSelfShadowReceive) {
    factors.uniforms.mmdSelfShadowReceive.value = 0;
  }
  const flags = material.userData?.mmdMaterial?.flags as { selfShadow?: boolean } | undefined;
  if (flags) flags.selfShadow = false;
  material.userData.mmdDisableModelReceiveShadow = true;
}

/**
 * Models cast onto the ground receiver only.
 * - receiveShadow stays false (no character-to-character / full-frame dark patches)
 * - outline helper meshes do not cast (avoids doubled silhouette shadows)
 * - MMD self-shadow uniform forced off
 */
export function enableModelShadows(model: ThreeMmdModel) {
  model.root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const name = (mesh.name || "").toLowerCase();
    const isOutline =
      name.includes("outline")
      || Boolean(mesh.userData?.mmdOutline)
      || Boolean((mesh as THREE.Object3D & { isMmdOutline?: boolean }).isMmdOutline);
    mesh.castShadow = !isOutline;
    mesh.receiveShadow = false;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of list) {
      if (material) disableMmdSelfShadowUniforms(material);
    }
  });
}

export type EnforceCastOnlyOptions = {
  /**
   * Only force receiveShadow=false (for TSL materials).
   * Avoid mutating mmdMaterial.flags / uniforms that the official TSL pipeline owns.
   */
  receiveOnly?: boolean;
};

/** Re-assert cast-only after material/loader hooks that may flip receiveShadow back on. */
export function enforceModelCastOnlyShadows(root: THREE.Object3D, options: EnforceCastOnlyOptions = {}) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.receiveShadow = false;
    if (options.receiveOnly) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of list) {
      if (material) disableMmdSelfShadowUniforms(material);
    }
  });
}

export type ApplyModelTransformOptions = {
  /**
   * Bullet uploads rigid-body sizes in model units and never scales them with
   * the Three.js root. Keep scale at 1 while stepping physics, then restore the
   * user scale for rendering so colliders stay aligned with the skeleton.
   */
  physicsStep?: boolean;
};

export function applyModelTransform(entry: RuntimeEntry, options: ApplyModelTransformOptions = {}) {
  const t = entry.transform;
  const scale = Math.min(10, Math.max(0.01, t.scale));
  entry.model.root.position.set(t.positionX, t.positionY, t.positionZ);
  entry.model.root.rotation.set(
    THREE.MathUtils.degToRad(t.rotationX),
    THREE.MathUtils.degToRad(t.rotationY),
    THREE.MathUtils.degToRad(t.rotationZ),
  );
  entry.model.root.scale.setScalar(options.physicsStep ? 1 : scale);
  if (t.scale !== scale) entry.transform = { ...t, scale };
}

export function applyMorphOverrides(entry: RuntimeEntry) {
  const influences = entry.model.mesh.morphTargetInfluences;
  const dict = entry.model.mesh.morphTargetDictionary;
  if (!influences || !dict) return;
  for (const [name, weight] of Object.entries(entry.morphWeights)) {
    const index = dict[name];
    if (index == null) continue;
    influences[index] = Math.min(1, Math.max(0, weight));
  }
  const bodies = (entry.model.mesh.userData as { mmdMorphSplitBodyMeshes?: THREE.SkinnedMesh[] }).mmdMorphSplitBodyMeshes;
  if (!Array.isArray(bodies)) return;
  for (const body of bodies) {
    const target = body.morphTargetInfluences;
    const map = body.userData?.mmdMorphSplit?.morphTargetIndices as Uint16Array | Uint32Array | undefined;
    if (!target || !map) continue;
    for (let i = 0; i < map.length; i += 1) {
      const sourceIndex = map[i];
      if (sourceIndex != null && sourceIndex < influences.length) target[i] = influences[sourceIndex] ?? 0;
    }
  }
}

function wrapMergedAnimation(animation: MmdAnimation): ThreeMmdAnimation {
  return {
    source: animation.bytes,
    name: "merged-body-face",
    animation,
  };
}

export function recomputeEntryAnimation(entry: RuntimeEntry) {
  const body = entry.bodyAnimation?.animation ?? null;
  const face = entry.faceAnimation?.animation ?? null;
  const camera = entry.cameraAnimation?.animation ?? null;
  const merged = mergeMotionAnimations(body, face, camera);
  if (!merged) {
    entry.appliedAnimation = null;
    entry.hasCameraTrack = false;
    entry.duration = 0;
    return;
  }
  // Single layer: reuse original ThreeMmdAnimation wrapper when possible.
  if (body && !face && !camera && entry.bodyAnimation) {
    entry.appliedAnimation = entry.bodyAnimation;
  } else if (face && !body && !camera && entry.faceAnimation) {
    entry.appliedAnimation = entry.faceAnimation;
  } else if (camera && !body && !face && entry.cameraAnimation) {
    entry.appliedAnimation = entry.cameraAnimation;
  } else {
    entry.appliedAnimation = wrapMergedAnimation(merged);
  }
  entry.hasCameraTrack = Boolean(entry.appliedAnimation?.animation.cameraFrames.length);
  entry.duration = entry.appliedAnimation
    ? getMmdAnimationDurationSeconds(entry.appliedAnimation.animation)
    : 0;
  if (entry.appliedAnimation) entry.model.setAnimation(entry.appliedAnimation);
}

export function toSnapshot(entry: RuntimeEntry): RuntimeModelSnapshot {
  return {
    id: entry.id,
    name: entry.name,
    visible: entry.visible,
    morphNames: entry.morphNames,
    materialNames: entry.materialNames,
    bodyMotionName: entry.bodyMotionName,
    faceMotionName: entry.faceMotionName,
    cameraMotionName: entry.cameraMotionName,
    morphWeights: { ...entry.morphWeights },
    morphFavorites: [...entry.morphFavorites],
    materialVisible: { ...entry.materialVisible },
    materialOverrides: { ...entry.materialOverrides },
    transform: cloneTransform(entry.transform),
    hasCameraTrack: entry.hasCameraTrack,
    duration: entry.duration,
  };
}
