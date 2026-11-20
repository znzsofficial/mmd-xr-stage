// Clinic metres, north = -Z. The garden forks off the existing flower walk
// south of the last fence post. No rotation when the XR origin changes room.
export const CLINIC_ORIGIN={x:-20.6,z:4.4};
export const SOUTH_DOOR={z:4.8,wallGap:4.90,clear:2.58,head:2.40,inGate:4.53,outGate:5.09};
export type Area={x:number;z:number;w:number;d:number};
type Solid=Area&{bottom:number;top:number};
const box=(x:number,z:number,w:number,d:number,top:number,bottom=0):Solid=>({x,z,w,d,top,bottom});
export const APRON=box(0,7.48,7.30,5.40,0);
export const CANOPY_POSTS=[-2.83,2.83].map(x=>box(x,8.53,.36,.39,2.85));
export const GLAZING=[-1,1].map(s=>box(s*(SOUTH_DOOR.clear+SOUTH_DOOR.wallGap)/4,SOUTH_DOOR.z,(SOUTH_DOOR.wallGap-SOUTH_DOOR.clear)/2,.18,SOUTH_DOOR.head));
export const BEDS=[box(-3.33,11.59,4.27,1.56,.49),box(3.37,13.63,5.41,1.29,.43),box(7.42,10.12,3.55,1.25,.41)];
export const GUIDE=box(16.71,1.05,.56,.56,1.78);
export const TREES=[{x:-4.19,z:11.64,h:3.48},{x:4.60,z:13.69,h:3.04}];
export const WALK_POINTS:readonly (readonly [number,number])[]=[[19.18,1.36],[16.48,2.10],[13.30,3.58],[10.30,5.10],[7.69,6.68],[5.19,8.68],[3.30,9.74],[1.82,10.08],[.66,9.73],[0,8.90]];
export const WALK_WIDTH=1.85;
export const SOUTH_FACE=[-1,1].map(s=>box(s*(8.6+SOUTH_DOOR.wallGap/2)/2,SOUTH_DOOR.z,8.6-SOUTH_DOOR.wallGap/2,.25,3.12));
export const approachSolids:Solid[]=[...GLAZING,...CANOPY_POSTS,...BEDS,GUIDE,
  ...TREES.map(t=>box(t.x,t.z,.26,.26,t.h)), box(0,SOUTH_DOOR.z,SOUTH_DOOR.wallGap,.24,3.12,SOUTH_DOOR.head),box(0,6.72,6.75,4.47,3.13,2.82)];
const footprint=box(0,-2.1,17.40,13.80,3.2);
const preview=[box(0,-2.52,17.40,13.08,3.2),...SOUTH_FACE]; // lawn proxy interior ends just behind entry seam
export function touches(x:number,z:number,r:Area,margin=0){
  return Math.hypot(Math.max(0,Math.abs(x-r.x)-r.w/2),Math.max(0,Math.abs(z-r.z)-r.d/2))<=margin;
}
export function onBranch(x:number,z:number,margin=0){
  for(let i=1;i<WALK_POINTS.length;i++){
    const [ax,az]=WALK_POINTS[i-1],[bx,bz]=WALK_POINTS[i],dx=bx-ax,dz=bz-az;
    const t=Math.min(1,Math.max(0,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
    if(Math.hypot(x-ax-t*dx,z-az-t*dz)<=WALK_WIDTH/2+margin)return true;
  }return false;
}
export function reserveLawnClinic(x:number,z:number,margin=0){
  x-=CLINIC_ORIGIN.x;z-=CLINIC_ORIGIN.z;
  return touches(x,z,footprint,margin)||touches(x,z,APRON,margin)||onBranch(x,z,margin)||BEDS.some(r=>touches(x,z,r,margin));
}
export function approachFootClear(x:number,z:number,r:number){return !approachSolids.some(s=>s.bottom<2&&touches(x,z,s,r));}
function lawnClear(x:number,z:number,r:number){
  x-=CLINIC_ORIGIN.x;z-=CLINIC_ORIGIN.z;
  return !preview.some(s=>touches(x,z,s,r))&&approachFootClear(x,z,r);
}
export const canPlaceByLawnClinic=(x:number,z:number)=>lawnClear(x,z,.26);
export const canWalkByLawnClinic=(x:number,z:number)=>lawnClear(x,z,.22);
export function moveByLawnClinic(x:number,z:number,dx:number,dz:number){
  const length=Math.hypot(dx,dz);if(!Number.isFinite(length)||length>32)return {x,z};
  const steps=Math.ceil(length/.105);
  for(let i=0;i<steps;i++){
    const nx=x+dx/steps,nz=z+dz/steps;
    if(canWalkByLawnClinic(nx,nz)){x=nx;z=nz;}
    else if(dx&&canWalkByLawnClinic(nx,z))x=nx;
    else if(dz&&canWalkByLawnClinic(x,nz))z=nz;
    else break;
  }return {x,z};
}
export type Eye={x:number;y:number;z:number};
export function groundVisible(from:Eye,x:number,z:number,occluders:readonly Solid[]){
  if(![from.x,from.y,from.z,x,z].every(Number.isFinite))return false;
  const dx=x-from.x,dy=.012-from.y,dz=z-from.z;
  return !occluders.some(r=>{
    let lo=0,hi=1;
    function slab(p:number,d:number,min:number,max:number){
      if(Math.abs(d)<1e-8)return p>=min&&p<=max;
      const a=(min-p)/d,b=(max-p)/d;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));return lo<=hi;
    }
    return slab(from.x,dx,r.x-r.w/2,r.x+r.w/2)&&slab(from.z,dz,r.z-r.d/2,r.z+r.d/2)&&slab(from.y,dy,r.bottom,r.top);
  });
}
const outsideOccluders=[...approachSolids,...preview];
export function lawnClinicPlacementVisible(from:Eye,x:number,z:number){
  return groundVisible({x:from.x-CLINIC_ORIGIN.x,y:from.y,z:from.z-CLINIC_ORIGIN.z},x-CLINIC_ORIGIN.x,z-CLINIC_ORIGIN.z,outsideOccluders);
}
