import * as THREE from "three";

export function prepareStageObject(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const deformed = Boolean((mesh as THREE.SkinnedMesh).isSkinnedMesh || mesh.morphTargetInfluences?.length);
    if (!deformed && !mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    mesh.frustumCulled = !deformed;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
}
