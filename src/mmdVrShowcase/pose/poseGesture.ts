import { Plane, type Ray, Vector3 } from 'three';

/** The center never snaps to the surface hit. XR carries it at the acquired ray depth;
 * a screen pointer moves it in the plane parallel to the film at pointer-down. */
export function poseTranslation(ray: Ray, hit: Vector3, center: Vector3, viewNormal: Vector3, xr: boolean) {
  const depth = hit.distanceTo(ray.origin), offset = center.clone().sub(hit);
  const plane = new Plane().setFromNormalAndCoplanarPoint(viewNormal,hit);
  return (next: Ray, out: Vector3) => {
    if (xr) next.at(depth,out);
    else if (!next.intersectPlane(plane,out)) return false;
    out.add(offset);
    return true;
  };
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
