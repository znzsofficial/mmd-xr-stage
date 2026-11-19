import { Vector3 } from 'three';

export type FerrySide = 'left' | 'right';
export const SIDES = ['left', 'right'] as const;
export const GATE_X = 3.82, GATE_Y = .64, GATE_Z = -8, GATE_RADIUS = .79;
export const WATER_Y = -.16;
export const sideSign = (side: FerrySide) => side === 'left' ? -1 : 1;

/** World-space intersection with the opening (including its straight lower jambs). */
export function aimFerry(origin: Vector3, direction: Vector3): FerrySide | null {
  if (Math.abs(direction.z) < 1e-8) return null;
  const t = (GATE_Z - origin.z) / direction.z;
  if (!(t > 0 && t * direction.length() <= 30)) return null;
  const x = origin.x + t * direction.x, y = origin.y + t * direction.y;
  if (y < WATER_Y + .12) return null;
  for (const side of SIDES) {
    if ((x - sideSign(side) * GATE_X) ** 2 + Math.max(0, y - GATE_Y) ** 2 <= (GATE_RADIUS - .06) ** 2) return side;
  }
  return null;
}

const RING_THROUGH = 1.05, RING_END = 1.39, SAIL_TIME = 7.8;
type Voyage = {
  side: FerrySide; elapsed: number; origin: Vector3; ray: Vector3; distance: number;
};
let current: Voyage | null = null;

/** Replaces the one in-flight effect. Copy the world-space muzzle; controllers reuse it each frame. */
export function launchFerry(side: FerrySide, origin?: Vector3) {
  const x = sideSign(side) * GATE_X;
  const from = origin?.clone() ?? new Vector3(x * .72, .78, -5.94);
  const ray = new Vector3(x, GATE_Y, GATE_Z).sub(from), distance = ray.length();
  if (!Number.isFinite(distance)) return;
  if (distance < 1e-6) ray.set(0, 0, -1); else ray.divideScalar(distance);
  current = { side, elapsed: 0, origin: from, ray, distance };
}

export function resetFerry() { current = null; }

export function advanceFerry(delta: number) {
  if (!current) return null;
  current.elapsed += Math.max(0, delta);
  if (!(current.elapsed < RING_THROUGH + SAIL_TIME)) current = null;
  return current;
}

/** Ring centre continues beyond the gate before its film breaks. Returns its size, or zero when gone. */
export function ringPose(v: Voyage, center: Vector3) {
  if (v.elapsed >= RING_END) return 0;
  const approach = Math.min(1, v.elapsed / RING_THROUGH);
  const past = Math.max(0, (v.elapsed - RING_THROUGH) / (RING_END - RING_THROUGH));
  center.copy(v.origin).addScaledVector(v.ray, v.distance * approach + .75 * past);
  return (.12 + .88 * Math.sqrt(approach)) * (1 + .24 * past) * Math.max(0, 1 - past ** 3);
}

/** Head-on at departure, in profile abeam of the viewer, then out through the opposite opening. */
export function boatPose(v: Voyage, center: Vector3) {
  const u = Math.max(0, Math.min(1, (v.elapsed - RING_THROUGH) / SAIL_TIME));
  const a = Math.PI * u, sin = Math.sin(a), cos = Math.cos(a), side = sideSign(v.side);
  center.set(side * GATE_X * cos, WATER_Y + .012 * Math.sin(5 * Math.PI * u), -8.75 + 2.2 * sin);
  return Math.atan2(-2.2 * cos, -side * GATE_X * sin);
}

export function boatSize(v: Voyage) {
  const t = v.elapsed - RING_THROUGH;
  return Math.max(0, Math.min(1, t / .48, (SAIL_TIME - t) / .62));
}
