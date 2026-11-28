// Clinic metres. The east garden door addresses the waiting bay between the two seat rows.
export const GARDEN_DOOR={x:8.6,z:2.80,wallGap:3.20,clear:2.04,head:2.42,inGate:8.36,outGate:8.94};
export type Area={x:number;z:number;w:number;d:number};
type Solid=Area&{bottom:number;top:number};
const box=(x:number,z:number,w:number,d:number,top:number,bottom=0):Solid=>({x,z,w,d,top,bottom});
const {x:face,z:mid,wallGap,clear,head}=GARDEN_DOOR;
export const APRON=box(10.25,mid,3.55,4.87,0);
export const CANOPY_POSTS=[box(11.53,.78,.40,.33,2.96)];
export const GLAZING=[-1,1].map(s=>box(face,mid+s*(clear+wallGap)/4,.15,(wallGap-clear)/2,head));
export const BEDS=[box(11.0,-.24,4.28,1.34,.47),box(13.84,4.90,3.79,1.40,.43)];
export const TREES=[{x:10.05,z:-.20,h:3.43},{x:14.80,z:4.91,h:3.17}];
export const EAST_FACE=[[-9,mid-wallGap/2],[mid+wallGap/2,4.8]].map(([a,b])=>box(face,(a+b)/2,.16,b-a,3.12));
export const DOOR_TRIM=box(face,mid,.30,wallGap+.09,head+.06,head-.06);
export const approachSolids:Solid[]=[...GLAZING,...CANOPY_POSTS,...BEDS,
  ...TREES.map(t=>box(t.x,t.z,.26,.26,t.h)),DOOR_TRIM,box(face,mid,.21,wallGap,3.13,DOOR_TRIM.top),box(10.2,mid,3.62,4.96,3.06,2.75)];
function touches(x:number,z:number,r:Area,margin:number){
  return Math.hypot(Math.max(0,Math.abs(x-r.x)-r.w/2),Math.max(0,Math.abs(z-r.z)-r.d/2))<=margin;
}
export function approachFootClear(x:number,z:number,r:number){return !approachSolids.some(s=>s.bottom<2&&touches(x,z,s,r));}
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
