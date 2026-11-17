import * as THREE from "three";

export function placeHudInFront(camera: THREE.Camera, parent: THREE.Object3D, panel: THREE.Object3D) {
  const eye = camera.getWorldPosition(new THREE.Vector3());
  const forward = camera.getWorldDirection(new THREE.Vector3());
  forward.y = 0;
  if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
  forward.normalize();
  const target = eye.clone().addScaledVector(forward, 1.8);
  target.y -= 0.12;
  panel.position.copy(parent.worldToLocal(target));
  parent.worldToLocal(eye);
  panel.rotation.set(0, Math.atan2(eye.x - panel.position.x, eye.z - panel.position.z), 0);
}
