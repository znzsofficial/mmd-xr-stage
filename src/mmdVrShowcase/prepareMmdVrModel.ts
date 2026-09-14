import type * as THREE from "three";

/** Animated MMD bounds can be stale after morphs, causing incorrect per-eye culling in VR. */
export function prepareMmdVrModel(root: THREE.Object3D) {
  root.traverse((object) => {
    object.frustumCulled = false;
  });
}
