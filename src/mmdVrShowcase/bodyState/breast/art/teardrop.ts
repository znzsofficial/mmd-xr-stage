import { chest, torsoWidth } from './figure';
import { areolaBand,localLift,type AreolaStyle } from './areola';
import type { Camera } from './geometry';
import { smooth } from './mesh';

// Approved study 02, in the original figure coordinates (+x = actor's left).
// A horizontal section of each lobe is an ellipse. The egg and the cage
// contribute to a single implicit field; the visible skin is its zero set.
export const middle=(f:number)=>.116-.021*f, height=(f:number)=>.559+.031*f;
export const sideFullness=(baseline:number,fill:number)=>baseline+.31*fill;
const sq=(x:number)=>x*x;
export function egg(y:number,f:number,settle=0){
  let h=(y-middle(f))/height(f);
  // Inverse displacement of this egg only. Never translate the cage, the
  // other side or the attachment at the top. At rest this is exactly study 02.
  if(settle)h-=.034*settle*smooth((.55-h)/1.28)/height(f);
  const low=Math.max(0,-h)**4;
  const rx=(.376+.031*f)*Math.exp(-.41*h-.16*low),rz=(.437+.064*f)*Math.exp(-.30*h-.15*low);
  return {h,rx,rz,ix:1/rx,iz:1/rz,x:.443-.039*h,z:.263+.018*f-.115*h-.019*h*h,blend:15+13*(.5+.5*Math.tanh((h+.54)*4))};
}
export type Egg=ReturnType<typeof egg>;
export function slice(y:number,lf:number,rf:number,ls=0,rs=0,style?:AreolaStyle){
  const make=(f:number,settle:number)=>{const e=egg(y,f,settle);return {...e,band:style?areolaBand(e,style):null};};
  const l=make(lf,ls),r=lf===rf&&ls===rs?l:make(rf,rs),w=torsoWidth(y),b=chest(0,y)[2];
  return {l,r,w,b,iw:1/w,ib:1/b};
}
export type Slice=ReturnType<typeof slice>;
export const eggNorm=(e:Egg,x:number,z:number)=>Math.sqrt(e.h*e.h+sq((x-e.x)*e.ix)+sq((z-e.z)*e.iz));
const lobe=(e:Slice['l'],x:number,z:number)=>{
  // Inverse anterior stretch: the zero set itself has a rounded shoulder
  // and crown. Back-facing skin and all rows outside this band stay exact.
  const b=e.band,extra=b&&z>e.z&&Math.abs(x-b.cx)<b.width?localLift(b,x):0;
  const n=extra?Math.sqrt(e.h*e.h+sq((x-e.x)*e.ix)+sq((z-e.z)/(e.rz+extra))):eggNorm(e,x,z);
  return Math.exp(-e.blend*.416*(n-1));
};
const rib=(s:Slice,x:number,z:number)=>{
  const beta=s.l===s.r?s.l.blend:s.r.blend+(s.l.blend-s.r.blend)*smooth((x+.10)/.20);
  return Math.exp(-beta*.42*(Math.sqrt(sq(x*s.iw)+sq(z*s.ib))-1));
};
export const field=(s:Slice,x:number,z:number)=>rib(s,x,z)+lobe(s.l,x,z)+lobe(s.r,-x,z)-1;
export const tissueWeight=(s:Slice,x:number,z:number)=>{
  const tissue=lobe(s.l,x,z)+lobe(s.r,-x,z);return tissue/(tissue+rib(s,x,z));
};

// At a skin hit at least one of the three positive field terms is >= 1/3.
// Bound that ellipse in this scan plane once per row instead of walking every
// ray all the way from the eye. The final hit still uses the exact sum above.
function rayEllipse(cam:Camera,x:number,z:number,rx:number,rz:number,h:number,scale:number,beta:number){
  const xx=rx*rx,zz=rz*rz,hh=xx*cam.c*cam.c+zz*cam.s*cam.s;
  return {h:x*cam.c-z*cam.s,d:x*cam.s+z*cam.c,inv:1/hh,skew:cam.s*cam.c*(xx-zz)/hh,
    extent:rx*rz/Math.sqrt(hh),limit:(1+Math.log(3)/(scale*beta))**2-h*h};
}
export function bounds(s:Slice,c:Camera){
  // The original slice ellipse could clip a displaced profile. The largest
  // possible local stretch gives a conservative bound for the whole row.
  return [rayEllipse(c,0,0,s.w,s.b,0,.42,Math.min(s.l.blend,s.r.blend)),
    rayEllipse(c,s.l.x,s.l.z,s.l.rx,s.l.rz+(s.l.band?.extra??0),s.l.h,.416,s.l.blend),
    rayEllipse(c,-s.r.x,s.r.z,s.r.rx,s.r.rz+(s.r.band?.extra??0),s.r.h,.416,s.r.blend)];
}
export function frontBound(row:ReturnType<typeof bounds>,h:number){
  let front=-Infinity;
  for(let i=0;i<3;i++){const p=row[i],dx=h-p.h,k=p.limit-dx*dx*p.inv;if(k>=0)front=Math.max(front,p.d+dx*p.skew+p.extent*Math.sqrt(k));}
  return front;
}
