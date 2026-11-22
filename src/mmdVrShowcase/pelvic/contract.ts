import type { Matrix4, Object3D, Vector3 } from 'three';

export type PelvicXYZ = readonly [number, number, number];
/** JSON asset data. Reference metres multiply by frame.scale to become world metres.
 * Offset is from the registered rest landmark, in its unpitched X/right, Y/up,
 * Z/outward basis. Positive pitch turns the inward (-Z) direction up. */
export interface PelvicCalibration {
  offsetM: PelvicXYZ;
  pitchDeg: number;
  yawDeg: number;
  radiusM: number;
  lengthM: number;
  /** Explicit manual registration for missing/unsuitable bones. Origin is in
   * actor-root local authored units; unitsPerMeter sets the manual ruler. */
  manual: { origin: PelvicXYZ; unitsPerMeter: number } | null;
}
export const defaultPelvicCalibration: PelvicCalibration = {
  offsetM: [0, 0, 0], pitchDeg: 32, yawDeg: 0, radiusM: .024, lengthM: .092, manual: null,
};

export interface PelvicSocket {
  readonly anchor: Object3D;
  readonly basisInAnchor: Matrix4;
  readonly kind: 'bones' | 'manual';
}
/** Both matrices are rigid; all section-local coordinates are TRUE WORLD METRES.
 * +Z points OUT; +X lateral, +Y superior. The inward curve starts along -Z. */
export interface PelvicFrame {
  world: Matrix4;
  inverse: Matrix4;
  scale: number;
  radiusM: number;
  lengthM: number;
}
export interface PelvicContact {
  inside: boolean;
  /** Actual verified outlet, independently gated by the opening plane. Use for liquid routing. */
  outletInside: boolean;
  /** May emit an exterior plume. False for untracked/blocked samples and an
   * occluded nozzle without valid admission, including overtravel past the stop. */
  outletVisible: boolean;
  depthM: number;
  atCervix: boolean;
  /** Real nozzle + shaft centreline, from base to nozzle, in frame-local world metres. */
  outletLocal: Vector3;
  shaftLocal: readonly Vector3[];
}
export interface PelvicInput {
  /** Unscaled, unclamped frame seconds; loss, ownership/target changes and seeks require reset(). */
  dt: number;
  /** Disabled physical input (e.g. a parked stand). Clothing visibility is not a tracking signal. */
  blocked?: boolean;
}
export interface PelvicSolver {
  /** Results/scratch are solver-owned until next step; pass actual PlayPiece parent.matrixWorld. */
  step(frame: PelvicFrame | null, pieceWorld: Matrix4 | null, input: PelvicInput): PelvicContact & { continuous:boolean; motion: ContactMotion | null };
  reset(): void;
}
/** Only a continuous, admitted crossing starts a response. Losing admission
 * through the side, overtravel or a tracking gap is not a withdrawal. */
export type ContactMotion = 'enter' | 'inside' | 'withdraw' | 'outside';

/** Sagittal contours for both UIs. X is zero, +Y up, -Z inward.
 * All paths are ordered boundary vertices (close each path in your renderer).
 * Entry → cervix is the same arc used by the rail, measured in world metres. */
export interface PelvicSection {
  canal: Vector3[];
  cervix: Vector3[];
  uterus: Vector3[];
  entry: Vector3;
  stop: Vector3;
}
export interface PelvicSeal {
  /** Outer perimeter and deformable lip, same cyclic order. Draw a strip
   * outer→lip; the closed lip becomes a zero-area slit; never touches actor skin. */
  outer: Vector3[];
  lip: Vector3[];
  openness: number;
}

// Public API in geometry.ts (same types re-exported there):
// registerPelvicSocket(root, calibration): PelvicSocket | null — cache until root/manual registration changes.
// samplePelvicFrame(socket, calibration, out?): PelvicFrame | null — after the displayed pose.
// pelvicCenterline(frame, depthM, out?): Vector3 — frame-local arc distance in metres; negative = outside.
// pelvicRailMatrix(frame, travelM, out?): Matrix4 — real, unit-scale PlayPiece parent WORLD pose.
// createPelvicSolver(): PelvicSolver — one instance per active actor + holder; all sources use step().
// pelvicSection(frame): PelvicSection — rebuild on dimensions change only.
// pelvicSeal(frame, contact, adapted, out?): PelvicSeal | null — opt-in only; local metres.
