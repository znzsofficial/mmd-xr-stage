import type {PickDeck,RoutePoint} from '../routes/types';

// The station's inland end is open from x=-4 to x=3. The park forecourt
// shares the actual platform level: no portal, crossing trigger or new room.
export const parkDeck:PickDeck={x:9.7,z:22.5,w:27,d:29,y:0};
// The original park meets the city crosswalk between the florist and coffee house.
export const laneMouth:PickDeck={x:21.4,z:39.68,w:4.25,d:5.36,y:0};
export const fountainCourt={x:4,z:23,radius:2.8};
export const parkTrees=[
  {x:-2.25,z:15.5,variant:0,scale:.84}, {x:9.2,z:12.2,variant:2,scale:.89},
  {x:19.1,z:14.3,variant:1,scale:.95}, {x:13,z:23,variant:0,scale:1.06},
  {x:12,z:30,variant:2,scale:.89}, {x:-2.05,z:30.7,variant:1,scale:.94},
];

// Each seat is in the lee of a crown, facing into the square. `yaw` rotates
// the long local X axis; the sitter looks along local -Z.
export const parkSeats=[
  {x:9.9,z:28.6,yaw:Math.PI/2}, {x:9.3,z:35.7,yaw:0},
  {x:15.7,z:19.9,yaw:.18}, {x:6.3,z:17.95,yaw:-Math.PI*.86},
];
export const seatWidth=2.12,seatDepth=.72;
export const parkBeds=[{x:16.4,z:21.8,w:4.7,d:1.9},{x:17.8,z:29.4,w:2.35,d:4.65},
  {x:-1.85,z:35.2,w:2.5,d:1.4},{x:6.7,z:9.25,w:3.9,d:1.25}];
export const parkLights=[{x:-3.05,z:10.4},{x:20.1,z:19.4},{x:20.1,z:32},{x:1.65,z:35.6}];

// Local +Z points OUT of a shop. Local +X runs right as seen from the park.
export const parkShops=[
  {kind:'bakery',x:-.8,z:37.2,yaw:Math.PI,w:6.4,d:5.9,h:5.85,color:'#eadabd',trim:'#507b73'},
  {kind:'books',x:6.8,z:37.65,yaw:Math.PI,w:8.1,d:7.2,h:9.25,color:'#ba7860',trim:'#f1debd'},
  {kind:'flowers',x:15.2,z:37.28,yaw:Math.PI,w:8.0,d:5.4,h:5.35,color:'#ebdfc3',trim:'#77958a'},
  {kind:'coffee',x:23.65,z:32.2,yaw:-Math.PI/2,w:7.8,d:6.2,h:9.7,color:'#e5dfc9',trim:'#477879'},
  {kind:'cycles',x:23.55,z:23.95,yaw:-Math.PI/2,w:7.7,d:5.4,h:5.6,color:'#aec1c2',trim:'#8e5845'},
  {kind:'kiln',x:23.5,z:15.45,yaw:-Math.PI/2,w:7.95,d:5.75,h:7.1,color:'#dbba97',trim:'#506675'},
] as const;

// Outdoor merchandise stays on the pavement. An oriented footprint follows
// that shop's local front into both the renderer and the placement queries.
export const windowDisplays={
  bakery:{offset:-1.55,out:.94,w:1.16,d:.60,h:1.02},
  books:{offset:-1.94,out:.83,w:1.38,d:.62,h:1.18},
  flowers:{offset:-2.12,out:.92,w:1.68,d:.85,h:1.18},
  coffee:{offset:-1.47,out:1.38,w:1.65,d:.77,h:.88},
  cycles:{offset:-1.38,out:.99,w:1.90,d:.60,h:1.13},
  kiln:{offset:-1.63,out:.82,w:1.42,d:.60,h:.96},
} as const;

type Rect={x:number;z:number;w:number;d:number;yaw?:number};
export type ParkBlock=Rect & {bottom:number;top:number};
export const parkWalls:ParkBlock[]=[
  {x:-3.72,z:22.52,w:.16,d:28.96,bottom:0,top:.70},
  {x:13.1,z:8.12,w:20.2,d:.2,bottom:0,top:.78},
];
const seatBlocks:ParkBlock[]=parkSeats.map(s=>({...s,w:seatWidth,d:seatDepth,bottom:.02,top:.89}));
const bedBlocks:ParkBlock[]=parkBeds.map(b=>({...b,bottom:0,top:.45}));
const shopBlocks:ParkBlock[]=parkShops.map(s=>({...s,x:s.x-Math.sin(s.yaw)*s.d/2,z:s.z-Math.cos(s.yaw)*s.d/2,bottom:0,top:s.h}));
const displayBlocks:ParkBlock[]=parkShops.map(s=>{
  const v=windowDisplays[s.kind],c=Math.cos(s.yaw),sn=Math.sin(s.yaw);
  return {x:s.x+c*v.offset+sn*v.out,z:s.z-sn*v.offset+c*v.out,w:v.w,d:v.d,yaw:s.yaw,bottom:0,top:v.h};
});
const streetBlocks=[...seatBlocks,...parkWalls,...bedBlocks,...shopBlocks,...displayBlocks];

function localXZ(rect:Rect,x:number,z:number){
  const dx=x-rect.x,dz=z-rect.z,c=Math.cos(rect.yaw??0),s=Math.sin(rect.yaw??0);
  return {x:dx*c-dz*s,z:dx*s+dz*c};
}
function within(rect:Rect,x:number,z:number,pad=0){
  const local=localXZ(rect,x,z);
  return Math.abs(local.x)<=rect.w/2+pad && Math.abs(local.z)<=rect.d/2+pad;
}
const nearCircle=(x:number,z:number,centre:{x:number;z:number},r:number)=>(x-centre.x)**2+(z-centre.z)**2<=r*r;

export function parkGround(x:number,z:number){
  // Do not admit a water landing even if real triangle collision is disabled
  // or the fountain renderer has not mounted yet. Seats/curbs remain solids.
  return (within(parkDeck,x,z)||within(laneMouth,x,z))&&!nearCircle(x,z,fountainCourt,fountainCourt.radius)?0:-Infinity;
}
export function parkPlace(x:number,z:number){
  const inLane=within(laneMouth,x,z,-.28)||(Math.abs(z-37)<.30&&Math.abs(x-laneMouth.x)<laneMouth.w/2-.28);
  return (inLane||within(parkDeck,x,z,-.28))&& !nearCircle(x,z,fountainCourt,fountainCourt.radius+.26)
    && !parkTrees.some(t=>nearCircle(x,z,t,.83))&&!parkLights.some(p=>nearCircle(x,z,p,.35))
    && !streetBlocks.some(b=>within(b,x,z,.26));
}

function clipsRange(p:number,d:number,min:number,max:number,interval:number[]){
  if(Math.abs(d)<1e-8)return p>=min&&p<=max;
  const a=(min-p)/d,b=(max-p)/d;
  interval[0]=Math.max(interval[0],Math.min(a,b));interval[1]=Math.min(interval[1],Math.max(a,b));
  return interval[0]<=interval[1];
}
export function crossesBlock(a:RoutePoint,b:RoutePoint,box:ParkBlock){
  const from=localXZ(box,a.x,a.z),to=localXZ(box,b.x,b.z),t=[0,1];
  return clipsRange(from.x,to.x-from.x,-box.w/2,box.w/2,t)&&clipsRange(from.z,to.z-from.z,-box.d/2,box.d/2,t)&&clipsRange(a.y,b.y-a.y,box.bottom,box.top,t);
}
function crossesCylinder(a:RoutePoint,b:RoutePoint,centre:{x:number;z:number},r:number,h:number){
  const t=[0,1];if(!clipsRange(a.y,b.y-a.y,0,h,t))return false;
  const dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz;
  const nearest=l2?((centre.x-a.x)*dx+(centre.z-a.z)*dz)/l2:0;
  const at=Math.max(t[0],Math.min(t[1],nearest));
  return nearCircle(a.x+at*dx,a.z+at*dz,centre,r);
}
const parkFoundation={...parkDeck,bottom:-1.64,top:-.035};
export function parkSight(a:RoutePoint,b:RoutePoint){
  if(Math.max(a.z,b.z)<8)return true;
  return !crossesBlock(a,b,parkFoundation)&&!streetBlocks.some(v=>crossesBlock(a,b,v))
    &&!crossesCylinder(a,b,fountainCourt,fountainCourt.radius,.46)&&!crossesCylinder(a,b,fountainCourt,.64,1.78)
    &&!parkTrees.some(t=>crossesCylinder(a,b,t,.18*t.scale,2.55*t.scale))
    &&!parkLights.some(p=>crossesCylinder(a,b,p,.085,3.55));
}

export const parkShots=[
  {key:'shoreParkEntry',eye:[-1.15,1.58,8.8],aim:[4.1,1.65,23.8]},
  {key:'shoreParkFountain',eye:[-.15,1.52,18.25],aim:[4.3,1.23,23.65]},
  {key:'shoreParkSeats',eye:[7.45,1.38,30.85],aim:[9.95,.87,28.45]},
  {key:'shoreParkShops',eye:[16.65,1.57,32.6],aim:[10.2,2.1,37.55]},
  {key:'shoreParkReturn',eye:[-.55,1.56,15.15],aim:[-.58,1.50,3.55]},
] as const;
