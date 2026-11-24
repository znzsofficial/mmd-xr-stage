import * as THREE from "three";
import { HAND_JOINTS } from "./handContactProfile";

/** 6 joints per hand (wrist + 5 finger tips), 2 hands → 12 fixed slots. */
export const MMD_VR_HAND_COLLIDER_SLOTS = HAND_JOINTS.length * 2;

const HIDDEN_HAND_MATRIX = new THREE.Matrix4().makeTranslation(0, -1_000, 0);
const handMatrices = Array.from({ length: MMD_VR_HAND_COLLIDER_SLOTS }, () => HIDDEN_HAND_MATRIX.clone());

export function setMmdVrHandColliderMatrix(index: number, matrix: THREE.Matrix4 | null) {
  if (index < 0 || index >= MMD_VR_HAND_COLLIDER_SLOTS) return;
  handMatrices[index].copy(matrix ?? HIDDEN_HAND_MATRIX);
}

export function getMmdVrHandColliderMatrices(): readonly THREE.Matrix4[] {
  return handMatrices;
}

export function clearMmdVrHandColliders() {
  for (const matrix of handMatrices) matrix.copy(HIDDEN_HAND_MATRIX);
}
