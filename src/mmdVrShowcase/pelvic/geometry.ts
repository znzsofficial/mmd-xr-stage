import { Vector3 } from 'three';
import type { PelvicContact, PelvicFrame, PelvicSeal, PelvicSection } from './contract';
import { pelvicCenterline, rod, rodRadii, tangent } from './path';
import {rimSamples as count,slitHalfLength} from './vulvaForm';

export * from './contract';
export { registerPelvicSocket, samplePelvicFrame } from './socket';
export { pelvicCenterline, pelvicRailLimit, pelvicRailMatrix } from './path';
export { createPelvicSolver } from './solver';

/** Section overlay data, all in the socket's rigid local axes and world metres.
 * Rebuild on dimension changes, not actor movement. The schematic uterus
 * starts behind the cervix and is not part of the traversable centreline. */
export function pelvicSection<F extends Pick<PelvicFrame,'lengthM'|'radiusM'>>(f: F): PelvicSection {
  const { lengthM: l, radiusM: r } = f, a: Vector3[] = [], b: Vector3[] = [], t = new Vector3(), n = new Vector3();
  for (let i=0; i<=24; i++) {
    const d = l*i/24, p = pelvicCenterline(f,d);
    tangent(f,d,t); n.set(0,-t.z,t.y);
    a.push(p.clone().addScaledVector(n,r)); b.push(p.addScaledVector(n,-r));
  }
  const entry = new Vector3(), stop = pelvicCenterline(f,l), cervix: Vector3[] = [], uterus: Vector3[] = [];
  const distal = (along: number, height: number) => stop.clone().addScaledVector(t,along).addScaledVector(n,height);
  for (let i=0; i<48; i++) {
    const angle = i*Math.PI/24, along = (1-Math.cos(angle))*.5, y = Math.sin(angle);
    cervix.push(distal(.23*l*along,.83*r*y));
    // A bounded pear-shaped outline with a narrow neck and tilted fundus.
    uterus.push(distal((.20+.75*along)*l,.21*l*along*along + (.46+1.65*along)*r*y));
  }
  return { canal:a.concat(b.reverse()), entry, stop, cervix, uterus };
}

const angles = Array.from({length:count},(_,i) => [Math.cos(i*2*Math.PI/count), Math.sin(i*2*Math.PI/count)]);
const makeLoop = () => Array.from({length:count},() => new Vector3());
/** Socket guides and measured entrance curve for the separate attachment.
 * The two resting slit edges coincide; the moving edge follows the actual
 * shaft-plane intersection, including an oblique section. */
export function pelvicSeal(f: Pick<PelvicFrame,'radiusM'>, contact: PelvicContact, adapted: boolean, target?: PelvicSeal): PelvicSeal | null {
  if (!adapted) return null;
  const seal = target ?? { outer:makeLoop(), lip:makeLoop(), openness:0 };
  const shaft = contact.shaftLocal, rim = f.radiusM;
  let x = 0, y = 0, radius = 0, dx = 0, dy = 0, stretch = 0;
  if (contact.inside) for (let i=1; i<shaft.length; i++) {
    const a = shaft[i-1], b = shaft[i];
    if (a.z < 0 || b.z > 0 || a.z === b.z) continue;
    const k = a.z/(a.z-b.z), length = a.distanceTo(b);
    const scale = length/rod[i-1].distanceTo(rod[i]);
    radius = (rodRadii[i-1]+(rodRadii[i]-rodRadii[i-1])*k)*scale;
    x = a.x+(b.x-a.x)*k; y = a.y+(b.y-a.y)*k;
    // Long axis lies along the projected shaft; stable when exactly end-on.
    const horiz = Math.hypot(b.x-a.x,b.y-a.y);
    if (horiz > 1e-9) { dx = (b.x-a.x)/horiz; dy = (b.y-a.y)/horiz; stretch = Math.min(1.5,length/(a.z-b.z))-1; }
    break;
  }
  seal.openness = Math.min(1,radius/rim);
  for (let i=0; i<count; i++) {
    const [c,s] = angles[i], extra = stretch*(c*dx+s*dy);
    seal.outer[i].set(1.62*rim*c,1.72*rim*s,0);
    // At rest the edges coincide along a vertical seam. Even a narrow tip
    // has a physical section; do not leave a gap above and below its crown.
    seal.lip[i].set(x+radius*(c+extra*dx),radius?y+radius*(s+extra*dy):rim*slitHalfLength*s,0);
  }
  return seal;
}
