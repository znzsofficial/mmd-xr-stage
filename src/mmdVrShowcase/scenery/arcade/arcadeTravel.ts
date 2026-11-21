import { lowerPad, upperPad, UPPER, type Point } from './arcadeLayout';

// Base only; the motor queries slab/step triangles at the current foot height.
export function baseGround(x: number, z: number) {
  return x > -14.84 && x < (Math.abs(z)<4.34 ? 13.84 : 12.84) && z > -5.84 && z < 12.84
    ? (x < -8 ? -.68 : 0) : -Infinity;
}

// Cross vertically inside the hole, then sideways above its lip. Both viewers
// validate the full route against scenery and live actors before moving.
export function arcadePassage(foot: Point, fits: (x:number,y:number,z:number) => boolean) {
  const down=Math.abs(foot.y-UPPER)<.08, near=down ? upperPad : lowerPad;
  if (Math.abs(foot.y-near.y)>.08 || Math.hypot(foot.x-near.x,foot.z-near.z)>.72) return null;
  const over={...lowerPad,y:UPPER};
  let p=foot;
  for (const q of down ? [upperPad,over,lowerPad] : [lowerPad,over,upperPad]) {
    const steps=Math.max(1,Math.ceil(Math.hypot(q.x-p.x,q.y-p.y,q.z-p.z)/.08));
    for (let i=1;i<=steps;i++) {
      const t=i/steps;
      if (!fits(p.x+(q.x-p.x)*t,p.y+(q.y-p.y)*t,p.z+(q.z-p.z)*t)) return null;
    }
    p=q;
  }
  return down ? lowerPad : upperPad;
}
