// Metres; the hall runs north (-Z), with a daylit waiting bay to its east.
// These rectangles feed the walls, furniture builders, floor print and navigation.
import {APRON, SOUTH_DOOR, approachFootClear, approachSolids, groundVisible} from './clinicApproach';
type Point3 = [number, number, number];
export interface ClinicRect { x: number; z: number; w: number; d: number }
const rect = (x: number, z: number, w: number, d: number): ClinicRect => ({ x, z, w, d });
export const WARD = { west:-8.6, east:8.6, north:-9, south:SOUTH_DOOR.z, left:-2.16, right:2.16, wcSouth:-3.25, orSouth:-.60, h:3.12, t:.16 };
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
  across(west,east,north),across(west,-SOUTH_DOOR.wallGap/2,south),across(SOUTH_DOOR.wallGap/2,east,south),along(west,north,south),along(east,north,south),
  across(west,left,wcSouth),across(right,east,orSouth),
  along(left,north,wc.z-wc.width/2), along(left,wc.z+wc.width/2,exam.z-exam.width/2),along(left,exam.z+exam.width/2,south),
  along(right,north,or.z-or.width/2),along(right,or.z+or.width/2,orSouth),
];

export const FIXTURES = {
  examChair:rect(-6.10,.05,1.24,2.03), ultrasound:rect(-7.46,.8,.86,.75),
  footControl:rect(-5.30,.58,.305,.243),
  stool:rect(-5.6,1.76,.53,.53), examCabinet:rect(-6.48,-2.77,3.15,.71),
  curtain:rect(-4.32,-.96,.18,1.21), consultDesk:rect(-6.46,4.26,2.3,.78),
  deskSeat:rect(-6.43,3.41,.62,.57), nurseLegs:rect(-6.43,3.77,.38,.43),
  table:rect(5.83,-4.85,1.1,2.27), anaesthesia:rect(7.20,-6.58,1.05,.86),
  steelCart:rect(4.26,-6.53,.88,.58), orCabinet:rect(5.19,-8.53,3.85,.72),
  scrub:rect(7.25,-1.04,1.65,.61), iv:rect(7.06,-4.32,.50,.50),
  sinks:rect(-4.44,-8.52,2.69,.73),
  supplyShelf:rect(-4.76,-3.59,1.42,.45), disposal:rect(-5.88,-3.64,.33,.37),
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
export const STALL_BINS = STALLS.map(({z})=>rect(-8.05,z-.70,.24,.26));
// Physical exhibit plinths share the existing counter. Their ray blockers
// occupy only their own height/width; rays can pass in the gaps above the counter.
export const EXHIBITS = [
  {...rect(-7.48,-2.69,.70,.32),top:1.55},
  {...rect(-6.49,-2.69,.68,.32),top:1.49},
  {...rect(-5.51,-2.69,.59,.32),top:1.56},
] as const;
export const TRAY_TOP=.95;
export const CLINIC_DEFAULT = {x:0,z:0};
export const CLINIC_VIEW: [Point3,Point3] = [[.24,1.58,3.80],[-.60,1.39,-5.25]];
export const CLINIC_SHOTS = [
  {key:'clinicHall', eye:[.67,1.54,3.74], aim:[3.37,1.35,-.94]},
  {key:'clinicExam', eye:[-3.12,1.53,2.34], aim:[-6.45,1.06,-.22]},
  {key:'clinicSurgery', eye:[3.24,1.58,-1.78], aim:[5.97,1.25,-5.43]},
  {key:'clinicRestroom', eye:[-2.83,1.51,-6.50], aim:[-6.99,1.08,-7.76]},
  {key:'clinicEducation', eye:[5.31,1.74,1.48], aim:[5.42,1.71,-.48]},
  {key:'clinicModels', eye:[-7.14,1.70,-.45], aim:[-6.53,1.69,-2.78]},
  {key:'clinicInstruments', eye:[4.26,1.47,-5.92], aim:[4.26,.885,-6.53]},
  {key:'clinicSupplies', eye:[-4.82,1.50,-6.11], aim:[-4.77,1.16,-3.61]},
] as const;

function hits(x:number,z:number,r:ClinicRect,clear:number) {
  const u=Math.max(0,Math.abs(x-r.x)-r.w*.5),v=Math.max(0,Math.abs(z-r.z)-r.d*.5);
  return u*u+v*v<=clear*clear;
}
// Include door trim, crash rails, slider faces and the lobby handrail.
const obstacles=[...WALLS.map(r=>({...r,w:r.w+.24,d:r.d+.24})), ...Object.values(FIXTURES), ...STALL_PANELS, ...TOILETS, ...STALL_BINS];
const cubicles=STALLS.map(({x,z,width})=>rect(x,z,2.14,width));
function clearAt(x:number,z:number,r:number) {
  const floor=(x>west+r&&x<east-r&&z>north+r&&z<south-r)||
    (Math.abs(x)<APRON.w/2-r&&z>=south-r&&z<APRON.z+APRON.d/2-r);
  return floor&&approachFootClear(x,z,r)&&!obstacles.some(o=>hits(x,z,o,r));
}
export function canWalkInClinic(x:number,z:number) { return clearAt(x,z,.22); }
export function canPlaceInClinic(x:number,z:number) { return clearAt(x,z,.26)&&!cubicles.some(o=>hits(x,z,o,.22)); }

// The shared invisible pointing plane also exists behind opaque walls. Test
// the eye/controller segment in 3D: seeing over a low bench is legitimate;
// aiming at a clear patch of floor through a cubicle door is not.
type Occluder=ClinicRect&{top:number;bottom:number};
const tops:Record<keyof typeof FIXTURES,number>={examChair:.83,footControl:.081,ultrasound:1.01,stool:.51,examCabinet:.90,curtain:2.45,consultDesk:.78,deskSeat:.81,nurseLegs:.61,table:.91,anaesthesia:1.03,steelCart:TRAY_TOP,orCabinet:.90,scrub:.94,iv:.12,seatsA:.47,seatsB:.47,seatsC:.47,kiosk:1.46,planter:.46,sinks:1.01,supplyShelf:1.64,disposal:.62};
const occluders:Occluder[]=[...approachSolids,...WALLS.map(r=>({...r,bottom:0,top:WARD.h})),...Object.values(DOORS).map(({x,z,width})=>({...rect(x,z,t,width),bottom:2.25,top:WARD.h})),...STALL_PANELS.map(r=>({...r,bottom:.22,top:2.06})),...TOILETS.map(r=>({...r,bottom:0,top:.46})),...STALL_BINS.map(r=>({...r,bottom:0,top:.52})),...EXHIBITS.map(r=>({...r,bottom:.90})),
  {...rect(FIXTURES.deskSeat.x,FIXTURES.deskSeat.z+.04,.38,.29),bottom:.55,top:1.31},
  ...[-1,1].map(k=>({...rect(FIXTURES.deskSeat.x+k*.16,FIXTURES.deskSeat.z+.39,.16,.59),bottom:.735,top:.88})),
  {...rect(FIXTURES.steelCart.x,FIXTURES.steelCart.z-.227,.38,.035),bottom:.84,top:1.09},
  ...(Object.keys(FIXTURES) as (keyof typeof FIXTURES)[]).map(k=>({...FIXTURES[k],bottom:k==='curtain'?.50:0,top:tops[k]}))];
export function clinicPlacementVisible(from:{x:number;y:number;z:number},x:number,z:number){
  return groundVisible(from,x,z,occluders);
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
