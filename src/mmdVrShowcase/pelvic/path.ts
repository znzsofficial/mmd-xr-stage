import { Matrix4, Vector3 } from 'three';
import { centerZ, siliconeMount, siliconeOutlet, siliconeTilt, tipHeight } from '../play/siliconeProfile';
import type { PelvicFrame } from './contract';

// A circular sagittal arc has an exact distance parameter and inverse. The
// exterior rail is its tangent; projection beyond the stop uses the end tangent.
const bend = .29;
const bounded = (x: number, max: number) => Math.max(0, Math.min(max, x));
export function pelvicCenterline(frame: Pick<PelvicFrame, 'lengthM'>, depthM: number, out = new Vector3()) {
  if (depthM < 0) return out.set(0, 0, -depthM);
  const r = frame.lengthM/bend, a = bounded(depthM, frame.lengthM)/r;
  return out.set(0, 2*r*Math.sin(a/2)**2, -r*Math.sin(a));
}
export function tangent(frame: Pick<PelvicFrame, 'lengthM'>, depthM: number, out: Vector3) {
  const a = bend*bounded(depthM, frame.lengthM)/frame.lengthM;
  return out.set(0, Math.sin(a), -Math.cos(a));
}
export function projectDepth(frame: Pick<PelvicFrame, 'lengthM'>, p: Vector3) {
  if (p.z >= 0) return -p.z;
  const r = frame.lengthM/bend, a = Math.atan2(-p.z, r-p.y);
  if (a <= bend) return r*a;
  return frame.lengthM + (p.y-2*r*Math.sin(bend/2)**2)*Math.sin(bend) - (p.z+r*Math.sin(bend))*Math.cos(bend);
}

// Sample the mould in its own axes, then apply the exact mesh transform once.
// Radii are conservative contact proxies from the actual rolled base, shaft
// and crown profile; lip and nozzle do not follow crown display squash.
export const rodHeights = [-.0456,-.037,-.023,-.009,.012,.038,.056,.073,.085,.096,.102,.107,.1122,.1165,tipHeight];
export const rodRadii = [.029,.026,.0178,.017,.0172,.0183,.019,.0186,.0171,.0202,.0194,.0176,.0137,.0087,.0022];
const part = new Matrix4().makeRotationX(siliconeTilt).setPosition(...siliconeMount);
export const rod = rodHeights.map(y => new Vector3(0,y,centerZ(y)).applyMatrix4(part));
export const nozzle = new Vector3(...siliconeOutlet.position), nozzleDir = new Vector3(...siliconeOutlet.direction);
const right = new Vector3(1,0,0), left = new Vector3(-1,0,0);
const socketFromPiece = new Matrix4().makeBasis(right, nozzleDir, right.clone().cross(nozzleDir)).setPosition(nozzle).invert();
const at = new Vector3(), axis = new Vector3(), normal = new Vector3();

/** A fixed-size tool cannot travel past the rolled flange on a large actor. */
export const pelvicRailLimit = (f: Pick<PelvicFrame, 'lengthM'>) => Math.min(f.lengthM, tipHeight+.024);

/** Transform the real PlayPiece PARENT (not the mesh, grip or decoration).
 * The inverse nozzle socket supplies both the bore offset and its tangent;
 * the half roll keeps the physical bend in the same sense as the canal. */
export function pelvicRailMatrix(frame: PelvicFrame, travelM: number, out = new Matrix4()) {
  const d = Math.min(travelM, pelvicRailLimit(frame));
  pelvicCenterline(frame,d,at); tangent(frame,d,axis);
  return out.makeBasis(left,axis,normal.crossVectors(left,axis)).setPosition(at).multiply(socketFromPiece).premultiply(frame.world);
}
