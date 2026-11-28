// Clinic metres. The east garden door addresses the waiting bay between the two seat rows.
export const CLINIC_ORIGIN={x:-23.8,z:5.3};
export const GARDEN_DOOR={x:8.6,z:2.80,wallGap:3.20,clear:2.04,head:2.42,inGate:8.36,outGate:8.94};
export type Area={x:number;z:number;w:number;d:number};
type Solid=Area&{bottom:number;top:number};
const box=(x:number,z:number,w:number,d:number,top:number,bottom=0):Solid=>({x,z,w,d,top,bottom});
const {x:face,z:mid,wallGap,clear,head}=GARDEN_DOOR;
export const APRON=box(10.25,mid,3.55,4.87,0);
export const CANOPY_POSTS=[box(11.53,.78,.40,.33,2.96)];
export const GLAZING=[-1,1].map(s=>box(face,mid+s*(clear+wallGap)/4,.15,(wallGap-clear)/2,head));
export const BEDS=[box(11.0,-.24,4.28,1.34,.47),box(13.84,4.90,3.79,1.40,.43)];
export const GUIDE=box(19.25,2.01,.44,.40,1.43);
export const TREES=[{x:10.05,z:-.20,h:3.43},{x:14.80,z:4.91,h:3.17}];
export const WALK_POINTS:readonly (readonly [number,number])[]=[[22.25,-.64],[20.25,.03],[18.10,1.36],[16.47,2.24],[14.72,2.72],[12.80,2.80],[11.72,2.80]];
export const WALK_WIDTH=2.04;
export const EAST_FACE=[[-9,mid-wallGap/2],[mid+wallGap/2,4.8]].map(([a,b])=>box(face,(a+b)/2,.16,b-a,3.12));
export const DOOR_TRIM=box(face,mid,.30,wallGap+.09,head+.06,head-.06);
export const approachSolids:Solid[]=[...GLAZING,...CANOPY_POSTS,...BEDS,GUIDE,
  ...TREES.map(t=>box(t.x,t.z,.26,.26,t.h)),DOOR_TRIM,box(face,mid,.21,wallGap,3.13,DOOR_TRIM.top),box(10.2,mid,3.62,4.96,3.06,2.75)];
const footprint=box(0,-2.1,17.40,13.80,3.2);
const preview=[box(-.42,-2.1,16.5,13.80,3.2),...EAST_FACE]; // stop beyond the seam, not at the drawn wall
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
