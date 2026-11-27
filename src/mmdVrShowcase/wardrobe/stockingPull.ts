import { Plane, Ray, Vector3 } from 'three';
import type { StockingSide, StockingTear } from './stockingState';

export type StockingHit = { side: StockingSide; u: number; v: number; point: Vector3; distance: number };
type Pick = (ray: Ray) => StockingHit | null;

/** Sample the UV tangents of the displayed fabric at acquisition. A pull can
 * then leave the narrow leg or continue while the dancer turns: its start and
 * direction stay on the grabbed piece, and motion of the actor isn't a drag. */
export function stockingPull(ray: Ray, grab: StockingHit, height: number, pick: Pick) {
  const start = grab.point.clone(), normal = ray.direction.clone(), plane = new Plane().setFromNormalAndCoplanarPoint(normal, start);
  const { side, u, v } = grab;
  const right = new Vector3(0, 1, 0);
  if (Math.abs(normal.y) > .98) right.set(1, 0, 0);
  right.crossVectors(normal, right).normalize();
  const up = new Vector3().crossVectors(right, normal), sample = new Ray(ray.origin.clone()), offset = new Vector3();
  const step = Math.max(.0001, height * .004);
  function tangent(axis: Vector3) {
    for (const sign of [1, -1]) {
      offset.copy(start).addScaledVector(axis, sign * step);
      sample.direction.subVectors(offset, ray.origin).normalize();
      const hit = pick(sample);
      if (!hit || hit.side !== side || hit.point.distanceTo(start) > step * 6) continue;
      const du = hit.u - u, dv = hit.v - v;
      return [(du - Math.round(du)) / (sign * step), dv / (sign * step)];
    }
    return [0, 0];
  }
  const x = tangent(right), y = tangent(up);
  return (next: Ray): StockingTear | null => {
    if (!next.intersectPlane(plane, offset) || offset.sub(start).length() < step * 2) return null;
    const dx = offset.dot(right), dy = offset.dot(up);
    const du = dx*x[0] + dy*y[0], dv = dx*x[1] + dy*y[1];
    // A single snag opens a local ladder in the knit, never half a leg when
    // the controller travels past the edge or the ray grazes the silhouette.
    const scale = Math.min(1, .23 / Math.max(.0001, Math.hypot(du, dv)));
    const tear = { side, u, v, du: du * scale, dv: Math.min(1 - v, Math.max(-v, dv * scale)) };
    return Math.hypot(tear.du, tear.dv) >= .012 ? tear : null;
  };
}
