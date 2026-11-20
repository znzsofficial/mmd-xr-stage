import {BED,CUP_TABLE,TRUNK,POST,FRONT,eachSheet,fullSweep,readDrapes,sheetBottom,sheetDepth,sheetTop} from './bridalLayout';

// Metres, level ground at Y=0. Enter from +Z; the hall faces the court (+Z).
export interface WeddingRect { x:number; z:number; w:number; d:number }
const rect = (x:number,z:number,w:number,d:number):WeddingRect => ({x,z,w,d});
const solid = (id:string, r:WeddingRect, top:number, bottom=0) => ({id,...r,bottom,top});
type Box = ReturnType<typeof solid>;

export const WEDDING_FLOORS = {
  lane:rect(0,9.55,11.6,7.1), court:rect(0,-1,11.6,14), dressing:rect(7.8,-5.1,4,5.4),
  bridal:rect(13.6,-6.1,7.6,7.4),
};
export const WEDDING_HALL_FRONT = -3.4;
export const WEDDING_DOORS = {
  gate:{x:0,z:6,width:3.2,head:2.75}, dressing:{x:5.8,z:-4.8,width:1.8,head:2.30},
  bridal:{x:9.8,z:-4.90,width:1.86,head:2.36},
};
const {gate,dressing,bridal} = WEDDING_DOORS;
const t=.20;
const alongX=(id:string,x0:number,x1:number,z:number,top:number)=>solid(id,rect((x0+x1)/2,z,x1-x0,t),top);
const alongZ=(id:string,x:number,z0:number,z1:number,top:number)=>solid(id,rect(x,(z0+z1)/2,t,z1-z0),top);
export const WEDDING_WALLS = [
  alongX('hallBack',-5.8,5.8,-8,3.45),
  alongZ('hallWest',-5.8,-8,WEDDING_HALL_FRONT,3.45), alongZ('courtWest',-5.8,WEDDING_HALL_FRONT,6,2.58),
  alongX('gateWest',-5.8,gate.x-gate.width/2,gate.z,2.60), alongX('gateEast',gate.x+gate.width/2,5.8,gate.z,2.60),
  alongZ('hallDressing',dressing.x,-8,dressing.z-dressing.width/2,3.45),
  alongZ('dressingCourt',dressing.x,dressing.z+dressing.width/2,-2.4,3.12), alongZ('courtEast',5.8,-2.4,6,2.58),
  alongX('dressingBack',5.8,9.8,-7.8,3.12), alongZ('dressingEast',9.8,-7.8,bridal.z-bridal.width/2,3.12), alongX('dressingSouth',5.8,9.8,-2.4,3.12),
  alongZ('dressingEastReturn',9.8,bridal.z+bridal.width/2,-2.4,3.12),alongZ('bridalWest',9.8,-9.8,-7.8,3.12),
  alongX('bridalNorth',9.8,17.4,-9.8,3.12),alongX('bridalSouth',9.8,17.4,-2.4,3.12),alongZ('bridalEast',17.4,-9.8,-2.4,3.12),
];
export const WEDDING_HEADERS = [
  solid('gateHead',rect(gate.x,gate.z,gate.width,.26),3.36,gate.head),
  solid('dressingHead',rect(dressing.x,dressing.z,.20,dressing.width),3.12,dressing.head),
  solid('bridalHead',rect(bridal.x,bridal.z,.20,bridal.width),3.12,bridal.head),
];
// Open leaves are axis-aligned in their parked pose, not invisible closed doors.
export const WEDDING_LEAVES = [
  ...[-1,1].map(side=>solid(side<0?'gateLeafWest':'gateLeafEast',rect(gate.x+side*(gate.width/2+.04),gate.z-.79,.08,1.56),gate.head-.06)),
  solid('dressingLeaf',rect(dressing.x+.77,dressing.z+dressing.width/2+.045,1.54,.09),dressing.head-.04),
  solid('bridalLeaf',rect(bridal.x+.80,bridal.z+bridal.width/2+.05,1.60,.10),bridal.head-.035),
];
export const WEDDING_SCREENS = [
  solid('spiritWall',rect(-2.4,4.4,2.4,.28),2.12),
  solid('dressingScreen',rect(8.10,-3.48,1.36,.16),1.77),
];
export const WEDDING_COLUMNS = [
  ...[-5.12,-2.90,2.90,5.12].map(x=>solid(`hallPost${x}`,rect(x,WEDDING_HALL_FRONT,.30,.30),3.40)),
  ...[-5.12,5.12].flatMap(x=>[.10,3.65].map(z=>solid(`galleryPost${x}_${z}`,rect(x,z,.26,.26),2.82))),
];

// Envelope of each completed piece (feasts include stools; sedan includes carrying poles).
export const WEDDING_ANCHORS = {
  sedan:rect(-2.9,8.5,1.6,3.6), feasts:[rect(-3.5,.35,2.2,2.2),rect(3.5,.35,2.2,2.2)],
  altar:rect(0,-6.95,2.8,.90), chairs:[rect(-2,-6.95,.72,.72),rect(2,-6.95,.72,.72)], vanity:rect(8.65,-6.95,1.6,.75),
};
export const WEDDING_MARKS = {
  pair:[{x:-.75,z:-4.98},{x:.75,z:-4.98}], pairFloor:rect(0,-4.98,3,2),
  sedan:{x:-1.48,z:8.48}, vanity:{x:8.62,z:-5.77},
  bridalNear:{x:11.60,z:-5.20},bridalBay:{x:BED.x,z:-7.10},
};
export const WEDDING_ENTRY = {x:.65,z:10.15};
// Across the lane the sedan's side silk and the whole gate roof fit in the
// same screen shot. XR still starts closer, facing straight down the aisle.
export const WEDDING_VIEW = [[3.68,2.29,12.76],[-1.00,2.01,7.04]] as const;
export const WEDDING_SHOTS = [
  {key:'weddingGate',eye:[.85,1.46,5.86],aim:[-2.24,1.01,8.50]},
  {key:'weddingFeast',eye:[3.43,1.48,-1.27],aim:[0,.94,-4.98]},
  {key:'weddingHall',eye:[0,1.49,-.10],aim:[0,.94,-4.98]},
  {key:'weddingVanity',eye:[7.36,1.47,-5.26],aim:[8.65,1.12,-6.95]},
  {key:'weddingFromRoom',eye:[7.58,1.52,-4.8],aim:[.50,1.15,-4.98]},
  {key:'weddingReturn',eye:[5.40,1.58,-4.48],aim:[-2.41,.99,8.48]},
  {key:'weddingBridal',eye:[12.50,1.56,-2.98],aim:[13.64,1.20,-7.78]},
  {key:'weddingCups',eye:[15.47,1.23,-4.85],aim:[16.47,.91,-4.25]},
  {key:'weddingBridalDoor',eye:[7.64,1.53,-4.53],aim:[12.46,1.08,-5.72]},
] as const;

const floorPieces=Object.values(WEDDING_FLOORS);
const floorAt=(x:number,z:number)=>floorPieces.some(r=>Math.abs(x-r.x)<=r.w/2 && Math.abs(z-r.z)<=r.d/2);
const architecture=[...WEDDING_WALLS,...WEDDING_COLUMNS,...WEDDING_LEAVES,...WEDDING_SCREENS];
const {sedan,chairs,altar,vanity,feasts}=WEDDING_ANCHORS;
const bedPosts=[-1,1].flatMap(s=>[-.78,.78,FRONT].map(v=>solid('bedPost',rect(BED.x+s*POST,BED.z+v,.116,.116),2.29)));
const footprints=[...architecture,sedan,altar,...chairs,vanity,BED,CUP_TABLE,TRUNK,...bedPosts];
function nearRect(r:WeddingRect,x:number,z:number,pad:number) {
  const u=Math.max(0,Math.abs(x-r.x)-r.w/2), v=Math.max(0,Math.abs(z-r.z)-r.d/2);
  return u*u+v*v<=pad*pad;
}
export function weddingClear(x:number,z:number,placing=false) {
  const pad=placing?.30:.21;
  // Test the joined floor before applying the footprint; individually inset
  // pieces would create a solid sill at both the gate and the dressing room.
  return Number.isFinite(x)&&Number.isFinite(z)&&floorAt(x,z)&&floorAt(x-pad,z)&&floorAt(x+pad,z)&&floorAt(x,z-pad)&&floorAt(x,z+pad)&&
    !footprints.some(r=>nearRect(r,x,z,pad)) && !feasts.some(f=>(x-f.x)**2+(z-f.z)**2<=(f.w/2+pad)**2) &&
    (Math.abs(x-BED.x)>1.8||Math.abs(z-BED.z-FRONT)>.60||
      !eachSheet(placing?fullSweep:readDrapes(),(cx,cz,w)=>nearRect(rect(cx,cz,w,sheetDepth),x,z,pad)));
}

export function moveInWedding(x:number,z:number,dx:number,dz:number) {
  if(!weddingClear(x,z))return {...WEDDING_ENTRY};
  const distance=Math.hypot(dx,dz);
  if(!Number.isFinite(distance)||distance>32||distance===0)return {x,z};
  const steps=Math.ceil(distance/.09), sx=dx/steps, sz=dz/steps;
  for(let i=0;i<steps;i++){
    if(weddingClear(x+sx,z+sz)){x+=sx;z+=sz;}
    else if(sx!==0&&weddingClear(x+sx,z))x+=sx;
    else if(sz!==0&&weddingClear(x,z+sz))z+=sz;
    else break;
  }
  return {x,z};
}

type Point3={x:number;y:number;z:number};
// A shoe keeps the full operational envelope clear. A pointing ray, on the
// other hand, may go above a carrying pole or a stool beside the table.
const relative=(r:WeddingRect,x:number,z:number,w:number,d:number)=>rect(r.x+x,r.z+z,w,d);
const rayBoxes = [...architecture,...WEDDING_HEADERS,
  solid('cabin',relative(sedan,0,0,1.06,1.14),1.78,.29),
  solid('roof',relative(sedan,0,0,1.28,1.34),1.94,1.78),
  solid('roofFinial',relative(sedan,0,0,.20,.20),2.21,1.94),
  solid('step',relative(sedan,0,-.727,.865,.226),.22,.162),
  ...[-1,1].flatMap(s=>[
    solid('stepBearer',relative(sedan,s*.40,-.66,.065,.38),.1965,.1235),
    solid('crossbar',relative(sedan,0,s*.46,1.52,.077),.75,.68),
    solid('pole',relative(sedan,s*.70,0,.072,sedan.d),.676,.604),
  ]),
  solid('altar',altar,.90),...chairs.map(r=>solid('chair',r,.51)),
  ...chairs.map(r=>solid('chairBack',relative(r,0,-.27,r.w,.15),1.23,.51)),
  solid('vanity',vanity,.79), solid('mirrorStand',relative(vanity,.03,-.17,.64,.06),.91,.79),
  solid('bed',BED,.665),solid('bedBack',relative(BED,0,-.79,BED.w,.12),1.40),
  ...[-1,1].flatMap(k=>[solid('bedSide',relative(BED,k*POST,0,.066,1.53),1.075,.62),
    solid('bedRail',relative(BED,k*POST,0,.08,1.54),1.274,1.206),solid('bolster',relative(BED,k*.75,-.49,.93,.32),.867,.64)]),
  ...bedPosts,solid('canopy',relative(BED,0,.69,3.12,3.14),2.49,2.18),
  solid('trunk',TRUNK,.59),solid('cupTable',CUP_TABLE,.80),
  solid('pairedCups',relative(CUP_TABLE,-.10,-.04,.38,.18),.949,.80),solid('flask',relative(CUP_TABLE,.15,.38,.17,.17),1.10,.80),
];
const rayRounds = feasts.flatMap(f=>[
  {x:f.x,z:f.z,r:.67,bottom:0,top:.77},
  ...Array.from({length:4},(_,i)=>{
    const angle=(.25+i*.5)*Math.PI;
    return {x:f.x+Math.cos(angle)*.90,z:f.z+Math.sin(angle)*.90,r:.18,bottom:0,top:.44};
  }),
]);
const rayDiscs = [
  {x:altar.x,y:1.65,z:altar.z-.29,r:.44,d:.05},
  {x:vanity.x+.03,y:1.16,z:vanity.z-.17,r:.255,d:.04},
];

// Clip a finite segment, not the infinite line: keep the portal beyond a
// ray endpoint open. Slabs include their actual vertical intervals.
function crossesBox(from:Point3,dx:number,dy:number,dz:number,b:Box) {
  let lo=0,hi=1;
  function slab(p:number,d:number,min:number,max:number) {
    if(Math.abs(d)<1e-9)return p>=min && p<=max;
    const a=(min-p)/d,c=(max-p)/d;
    lo=Math.max(lo,Math.min(a,c));hi=Math.min(hi,Math.max(a,c));return lo<=hi;
  }
  return slab(from.x,dx,b.x-b.w/2,b.x+b.w/2)&&slab(from.z,dz,b.z-b.d/2,b.z+b.d/2)&&slab(from.y,dy,b.bottom,b.top);
}
// Cylinder along the axis k, with its centre subtracted from u/v. Used
// upright for the seats and sideways for the freestanding bronze mirror.
function crossesCylinder(k:number,dk:number,min:number,max:number,u:number,du:number,v:number,dv:number,r:number) {
  let lo=0,hi=1;
  if(Math.abs(dk)<1e-9){if(k<min||k>max)return false;}
  else {
    const a=(min-k)/dk,c=(max-k)/dk;
    lo=Math.max(0,Math.min(a,c));hi=Math.min(1,Math.max(a,c));if(lo>hi)return false;
  }
  const den=du*du+dv*dv, t=den===0?lo:Math.max(lo,Math.min(hi,-(u*du+v*dv)/den));
  return (u+t*du)**2+(v+t*dv)**2<=r*r;
}

export function weddingSightline(from:Point3,to:Point3) {
  if(![from.x,from.y,from.z,to.x,to.y,to.z].every(Number.isFinite))return false;
  const dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z;
  return !rayBoxes.some(b=>crossesBox(from,dx,dy,dz,b)) &&
    !eachSheet(readDrapes(),(x,z,w)=>crossesBox(from,dx,dy,dz,solid('curtain',rect(x,z,w,sheetDepth),sheetTop,sheetBottom))) &&
    !rayRounds.some(b=>crossesCylinder(from.y,dy,b.bottom,b.top,from.x-b.x,dx,from.z-b.z,dz,b.r)) &&
    !rayDiscs.some(b=>crossesCylinder(from.z,dz,b.z-b.d/2,b.z+b.d/2,from.x-b.x,dx,from.y-b.y,dy,b.r));
}
export function weddingVisible(from:Point3,x:number,z:number) {
  return from.y>.012 && weddingSightline(from,{x,y:.012,z});
}
