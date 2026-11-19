// Metres; the hall runs north (-Z), with a daylit waiting bay to its east.
// These rectangles feed the walls, furniture builders, floor print and navigation.
type Point3 = [number, number, number];
export interface ClinicRect { x: number; z: number; w: number; d: number }
const rect = (x: number, z: number, w: number, d: number): ClinicRect => ({ x, z, w, d });
export const WARD = { west:-8.6, east:8.6, north:-9, south:4.8, left:-2.16, right:2.16, wcSouth:-3.25, orSouth:-.60, h:3.12, t:.16 };
export const DOORS = {
  exam: { x:WARD.left, z:.90, width:1.56 },
  wc: { x:WARD.left, z:-6.30, width:1.45 },
  or: { x:WARD.right, z:-3.45, width:1.90 },
};
const {west,east,north,south,left,right,wcSouth,orSouth,t} = WARD;
const across = (a:number,b:number,z:number) => rect((a+b)/2,z,b-a,t);
const along = (x:number,a:number,b:number) => rect(x,(a+b)/2,t,b-a);
const {exam,wc,or} = DOORS;
export const WALLS = [
  across(west,east,north),across(west,east,south),along(west,north,south),along(east,north,south),
  across(west,left,wcSouth),across(right,east,orSouth),
  along(left,north,wc.z-wc.width/2), along(left,wc.z+wc.width/2,exam.z-exam.width/2),along(left,exam.z+exam.width/2,south),
  along(right,north,or.z-or.width/2),along(right,or.z+or.width/2,orSouth),
];

export const FIXTURES = {
  examChair:rect(-6.10,.05,1.24,2.03), ultrasound:rect(-7.46,.8,.86,.75),
  footControl:rect(-5.30,.58,.305,.243),
  stool:rect(-5.6,1.76,.53,.53), examCabinet:rect(-6.48,-2.77,3.15,.71),
  curtain:rect(-4.32,-.96,.18,1.21), consultDesk:rect(-6.46,4.26,2.3,.78),
  deskSeat:rect(-5.94,3.36,.62,.57),
  table:rect(5.83,-4.85,1.1,2.27), anaesthesia:rect(7.20,-6.58,1.05,.86),
  steelCart:rect(4.26,-6.53,.88,.58), orCabinet:rect(5.19,-8.53,3.85,.72),
  scrub:rect(7.25,-1.04,1.65,.61), iv:rect(7.06,-4.32,.50,.50),
  sinks:rect(-4.44,-8.52,2.69,.73),
  seatsA:rect(4.48,4.30,2.59,.72), seatsB:rect(6.99,1.19,2.59,.72),
  seatsC:rect(1.63,-6.70,.67,2.56), kiosk:rect(3.02,.13,.69,.58),
  planter:rect(.99,-8.55,.64,.64),
};
// Cubicles face the wash lobby. One door is latched; the other is folded
// inside the bay. Only the player's feet can enter the open cubicle.
export const STALLS = [-7.69,-5.50].map((z,index)=>({z,closed:index===1,x:-7.44,front:-6.40,width:2.19}));
export const STALL_PANELS = [rect(-7.45,-8.785,2.10,.054),rect(-7.45,-6.595,2.10,.054),rect(-7.45,-4.405,2.10,.054),
  ...STALLS.flatMap(({z,closed,front})=>[rect(front,z-.80,.055,.59),rect(front,z+.80,.055,.59),
    closed?rect(front,z,.055,1.015):rect(front-.51,z+.497,1.02,.055)]),
];
export const TOILETS = STALLS.map(({z})=>rect(-8.02,z,.77,.48));
export const CLINIC_DEFAULT = {x:0,z:0};
export const CLINIC_VIEW: [Point3,Point3] = [[.24,1.58,3.80],[-.60,1.39,-5.25]];
export const CLINIC_SHOTS = [
  {key:'clinicHall', eye:[.67,1.54,3.74], aim:[3.37,1.35,-.94]},
  {key:'clinicExam', eye:[-3.12,1.53,2.34], aim:[-6.45,1.06,-.22]},
  {key:'clinicSurgery', eye:[3.24,1.58,-1.78], aim:[5.97,1.25,-5.43]},
  {key:'clinicRestroom', eye:[-2.83,1.51,-6.50], aim:[-6.99,1.08,-7.76]},
  {key:'clinicEducation', eye:[5.31,1.74,1.48], aim:[5.42,1.71,-.48]},
] as const;

function hits(x:number,z:number,r:ClinicRect,clear:number) {
  const u=Math.max(0,Math.abs(x-r.x)-r.w*.5),v=Math.max(0,Math.abs(z-r.z)-r.d*.5);
  return u*u+v*v<=clear*clear;
}
// Include door trim, crash rails, slider faces and the lobby handrail.
const obstacles=[...WALLS.map(r=>({...r,w:r.w+.24,d:r.d+.24})), ...Object.values(FIXTURES), ...STALL_PANELS, ...TOILETS];
const cubicles=STALLS.map(({x,z,width})=>rect(x,z,2.14,width));
function clearAt(x:number,z:number,r:number) {
  return Number.isFinite(x)&&Number.isFinite(z)&&x>west+r&&x<east-r&&z>north+r&&z<south-r&&!obstacles.some(o=>hits(x,z,o,r));
}
export function canWalkInClinic(x:number,z:number) { return clearAt(x,z,.22); }
export function canPlaceInClinic(x:number,z:number) { return clearAt(x,z,.26)&&!cubicles.some(o=>hits(x,z,o,.22)); }

// The shared invisible pointing plane also exists behind opaque walls. Test
// the eye/controller segment in 3D: seeing over a low bench is legitimate;
// aiming at a clear patch of floor through a cubicle door is not.
type Occluder=ClinicRect&{top:number;bottom:number};
const tops:Record<keyof typeof FIXTURES,number>={examChair:.83,footControl:.081,ultrasound:1.01,stool:.51,examCabinet:.90,curtain:2.45,consultDesk:.78,deskSeat:.47,table:.91,anaesthesia:1.03,steelCart:.85,orCabinet:.90,scrub:.94,iv:.12,seatsA:.47,seatsB:.47,seatsC:.47,kiosk:1.46,planter:.46,sinks:1.01};
const occluders:Occluder[]=[...WALLS.map(r=>({...r,bottom:0,top:WARD.h})),...Object.values(DOORS).map(({x,z,width})=>({...rect(x,z,t,width),bottom:2.25,top:WARD.h})),...STALL_PANELS.map(r=>({...r,bottom:.22,top:2.06})),...TOILETS.map(r=>({...r,bottom:0,top:.46})),...(Object.keys(FIXTURES) as (keyof typeof FIXTURES)[]).map(k=>({...FIXTURES[k],bottom:k==='curtain'?.50:0,top:tops[k]}))];
export function clinicPlacementVisible(from:{x:number;y:number;z:number},x:number,z:number){
  if(!Number.isFinite(from.x)||!Number.isFinite(from.y)||!Number.isFinite(from.z)||!Number.isFinite(x)||!Number.isFinite(z))return false;
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

// Sweep short steps and slide on one axis when blocked. A missed input frame
// cannot step through a wall even when its intended destination is clear.
export function moveInClinic(x:number,z:number,dx:number,dz:number) {
  if (!canWalkInClinic(x,z)) return {...CLINIC_DEFAULT};
  if (!Number.isFinite(dx)||!Number.isFinite(dz)) return {x,z};
  const length=Math.hypot(dx,dz);
  if (length>32 || length===0) return {x,z};
  const steps=Math.ceil(length/.105);
  for (let i=0;i<steps;i++) {
    const nx=x+dx/steps,nz=z+dz/steps;
    if(canWalkInClinic(nx,nz)) { x=nx;z=nz; }
    else if(dx!==0&&canWalkInClinic(nx,z)) x=nx;
    else if(dz!==0&&canWalkInClinic(x,nz)) z=nz;
    else break;
  }
  return {x,z};
}
