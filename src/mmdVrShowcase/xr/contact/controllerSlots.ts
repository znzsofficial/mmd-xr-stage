import * as THREE from "three";

const HIDDEN_CONTROLLER_MATRIX = new THREE.Matrix4().makeTranslation(0, -1_000, 0);
const controllerMatrices = [HIDDEN_CONTROLLER_MATRIX.clone(), HIDDEN_CONTROLLER_MATRIX.clone()];

export function setMmdVrControllerColliderMatrix(index: 0 | 1, matrix: THREE.Matrix4 | null) {
  controllerMatrices[index].copy(matrix ?? HIDDEN_CONTROLLER_MATRIX);
}

export function getMmdVrControllerColliderMatrices(): readonly THREE.Matrix4[] {
  return controllerMatrices;
}

export function clearMmdVrControllerColliders() {
  controllerMatrices[0].copy(HIDDEN_CONTROLLER_MATRIX);
  controllerMatrices[1].copy(HIDDEN_CONTROLLER_MATRIX);
}
