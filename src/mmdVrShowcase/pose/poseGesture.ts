import { MathUtils, Plane, type Ray, Vector3 } from 'three';

/** Carry the original contact offset. Wheel travel moves the film-parallel plane
 * before intersecting the cursor, so a depth edit doesn't slide the grab sideways. */
export function screenPoseTranslation(ray: Ray, hit: Vector3, center: Vector3, facingEye: Vector3, metresPerPixel: number) {
  const offset = center.clone().sub(hit), plane = new Plane().setFromNormalAndCoplanarPoint(facingEye,hit);
  const initial = plane.constant, eyeDepth = plane.distanceToPoint(ray.origin);
  const rate = MathUtils.clamp(metresPerPixel * .14,.0002,.0012);
  return (next: Ray, out: Vector3, wheelPixels = 0) => {
    plane.constant = MathUtils.clamp(plane.constant + wheelPixels*rate, initial-eyeDepth+Math.min(.12,eyeDepth), initial+50);
    if (!next.intersectPlane(plane,out)) return false;
    out.add(offset); return true;
  };
}

/** The ray chooses the joint; after acquisition a centre follows hand translation
 * one-to-one. Small rotations of a remote pointer aren't long lever arms. */
export function carryPoseCenter(grip: Vector3, center: Vector3) {
  const offset = center.clone().sub(grip);
  return (position: Vector3, out: Vector3) => out.copy(position).add(offset);
}

/** A camera-facing dial controls the chosen rotation axis. atan2 avoids the
 * discontinuity at twelve o'clock and crossing the dead center re-arms the dial. */
export function poseDial(ray: Ray, center: Vector3, viewNormal: Vector3, deadRadius: number) {
  const pivot = center.clone(), plane = new Plane().setFromNormalAndCoplanarPoint(viewNormal,pivot);
  const previous = new Vector3(), radial = new Vector3(), cross = new Vector3();
  let ready = false;
  const sample = (next: Ray) => {
    if (!next.intersectPlane(plane,radial) || radial.sub(pivot).lengthSq() < deadRadius**2) { ready = false; return 0; }
    radial.normalize();
    const delta = ready ? Math.atan2(plane.normal.dot(cross.crossVectors(previous,radial)),previous.dot(radial)) : 0;
    ready = true; previous.copy(radial);
    return delta;
  };
  sample(ray);
  return sample;
}
