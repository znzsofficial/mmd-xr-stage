import { smooth } from './mesh';

// Material coordinates on the anterior half of study 02. The same small
// footprint drives both the depth field and its ink, including after settling.
export const areolaStyles=['soft','rounded'] as const;
export type AreolaStyle=(typeof areolaStyles)[number];
export const defaultAreolaStyle:AreolaStyle='soft';
export const areolaNames={zh:{soft:'轻柔',rounded:'圆隆'},en:{soft:'Soft',rounded:'Raised'}};

// Width is in slice radii, height in egg heights, relief in figure space.
// The wide, shallow shoulder and the much shorter crown each have a smooth
// return to their carrier. Neither operation changes the chest or lower pole.
const profiles={
  soft:   {width:.215,height:.129,shoulder:.009,crown:.033,core:.34,feather:.84,rose:.76},
  rounded:{width:.283,height:.173,shoulder:.021,crown:.060,core:.39,feather:.62,rose:1.04},
};
export function areolaBand(e:{h:number;x:number;rx:number},style:AreolaStyle){
  const p=profiles[style],v=(e.h+.39)/p.height;
  if(Math.abs(v)>=1)return null;
  // Keep the approved anterior/lateral placement while the egg grows. A
  // small tilt prevents the pigment and the crown from reading as a bullseye.
  const width=e.rx*p.width,cx=e.x+e.rx*.169*Math.sqrt(1-e.h*e.h)+width*.08*v;
  return {p,v,cx,width,iw:1/width,extra:p.shoulder+p.crown};
}
export type Band=NonNullable<ReturnType<typeof areolaBand>>;
const radius2=(b:Band,x:number)=>((x-b.cx)*b.iw)**2+b.v*b.v;
const crownRadius2=(q:number,b:Band)=>q/(b.p.core*b.p.core);
export function localLift(b:Band,x:number){
  const q=radius2(b,x);if(q>=1)return 0;
  const base=(1-q)**2,tip=Math.max(0,1-crownRadius2(q,b));
  // A rounded cap rather than a cone at 90°; the cap's basal edge is
  // tangent to the soft shoulder, including at coarse HUD resolution.
  return b.p.shoulder*base+b.p.crown*tip*tip*(3-2*tip);
}

// Pigment has a feathered margin, a warmer transition under the papilla and
// a small reflected highlight on normals facing the portrait's high key.
export function pigment(rgb:Uint8ClampedArray,k:number,b:Band,x:number,ny:number,lateral:number,eye:number,weight:number){
  const q=radius2(b,x);if(q>=1)return;
  const ink=(1-smooth((q-1+b.p.feather)/b.p.feather))*(1-.40*q)*b.p.rose*weight;
  const core=1-smooth((crownRadius2(q,b)-.18)/1.15);
  const half=-.25*lateral+.36*ny+.898*eye;
  const sheen=(.38*smooth((half-.78)/.20)+.62*smooth((half-.929)/.058))*(.21+.79*core)*ink;
  rgb[k]+=(-18-10*core)*ink+25*sheen;
  rgb[k+1]+=(-41-9*core)*ink+31*sheen;
  rgb[k+2]+=(-23-8*core)*ink+28*sheen;
}
