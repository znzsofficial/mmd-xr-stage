import type { Part } from './SceneryBatch';

/** Place a box or cylinder with its local Y axis connecting two points. */
export function span(a:Part['p'], b:Part['p'], width:number, color:string, depth=width):Part {
  const x=b[0]-a[0], y=b[1]-a[1], z=b[2]-a[2], l=Math.hypot(x,y,z);
  return {p:[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2],s:[width,l,depth],
    rx:Math.atan2(z,y), rz:l ? -Math.asin(x/l) : 0, color};
}
