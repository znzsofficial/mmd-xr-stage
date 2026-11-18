import { MathUtils, Vector3, type Object3D } from "three";

const up = new Vector3(0, 1, 0);

export function objectHeadingDegrees(object: Object3D) {
  const forward = new Vector3(0, 0, 1).applyQuaternion(object.quaternion);
  return MathUtils.euclideanModulo(MathUtils.radToDeg(Math.atan2(forward.x, forward.z)), 360);
}

export function setObjectHeadingDegrees(object: Object3D, degrees: number) {
  object.rotateOnWorldAxis(up, MathUtils.degToRad(degrees - objectHeadingDegrees(object)));
}
