import {westGallery} from './westGallery';

// Stage dimensions in metres, not measurements from the game. Facing the
// twin front doors from outside, east/LOUNGE is on the left (-X), west on +X.
export const UPPER = 3.4, ROOF = 6.65;
// Face the building from +Z. The setback is upstairs only: the strip is
// the roof of the front of the lower hall, not a canopy over an outdoor void.
export const upperFrontZ=4.5,cladding=.158,frontWalkDepth=2;
export const frontLip=upperFrontZ+cladding+frontWalkDepth,lowerFrontZ=frontLip-cladding;
export const entry = {x:-2.35,z:8.5};
export const opening = {left:-3.45,right:3.45,back:-1.84,front:1.42};
export const skylight = {left:-2.95,right:2.7,back:-1.16,front:1.88};
export const lowerPad = {x:-1.35,y:0,z:.68}, upperPad = {x:-1.35,y:UPPER,z:2.08};
export type Point = {x:number;y:number;z:number};
export type Block = Point & {w:number;h:number;d:number; ink:string;tag:string; deck?:boolean};
const boxes:Block[]=[];
function block(tag:string,x:number,lo:number,z:number,w:number,h:number,d:number,ink:string,deck=false){
  const b={tag,x,y:lo+h/2,z,w,h,d,ink,deck};boxes.push(b);return b;
}
function slab(tag:string,l:number,r:number,b:number,f:number,top:number,h:number,ink:string,deck=true){
  return block(tag,(l+r)/2,top-h,(b+f)/2,r-l,h,f-b,ink,deck);
}
const turf='#799687', tile='#626d7e', upperTile='#616875', teal='#569699', ivory='#c1b7a8';
// Base court and sunken lounge are distinct travel/pick surfaces. All treads
// have real tops; upper gallery is four plates, never an invisible whole quad.
slab('court',-8,13,frontLip,13,0,.20,'#999b95');
slab('court',-8,13,-6,-4.5,0,.20,'#999b95');
slab('court',-8,-7,-4.5,frontLip,0,.20,'#999b95');
slab('court',7,14,-4.5,frontLip,0,.20,'#90959e');
slab('lounge-court',-15,-8,-6,13,-.68,.22,turf);
slab('hall-tile',-7,7,-4.5,frontLip,0,.14,tile);
for(let i=0;i<4;i++)slab('lounge-step',-8-(i+1)*.43,-8-i*.43,-2.0,4.15,-.17*i,.20,'#999c98');
function ring(tag:string,hole:typeof opening,top:number,h:number,ink:string,deck:boolean){
  const {left:l,right:r,back:b,front:f}=hole;
  slab(tag,-7,7,-4.5,b,top,h,ink,deck); slab(tag,-7,7,f,4.5,top,h,ink,deck);
  slab(tag,-7,l,b,f,top,h,ink,deck); slab(tag,r,7,b,f,top,h,ink,deck);
}
ring('upper-slab',opening,UPPER,.27,upperTile,true);
ring('roof',skylight,ROOF,.24,'#475876',false);
slab('balcony',-7,7,upperFrontZ,frontLip,UPPER,.27,'#829396');
slab('west-walk',7,11.25,1.5,frontLip,UPPER,.26,'#708496');
slab('east-balcony',-8.7,-7,-4.45,frontLip,UPPER,.26,'#738e88');
// Solid stair cheek between the covered passage and the blue window lane.
for(let i=0;i<20;i++)slab('west-step',9.27,11.24,1.5-(20-i)*.31,1.5-(19-i)*.31,(i+1)*UPPER/20,(i+1)*UPPER/20,'#818c99');

// Split every wall at its actual door(s), including the header above each.
type Axis='x'|'z';
function wall(axis:Axis,at:number,half:number,base:number,height:number,doors:number[],trim:string,end=half){
  const w=1.78,dh=2.33,solid=(tag:string,a:number,b:number,lo:number,h:number,ink:string,thick:number)=>
    axis==='x'?block(tag,(a+b)/2,lo,at,b-a,h,thick,ink):block(tag,at,lo,(a+b)/2,thick,h,b-a,ink);
  let edge=-half;
  function fill(to:number){if(to<=edge)return;solid('wall',edge,to,base,height,ivory,.26);solid('skirting',edge,to,base,.54,'#966e70',.29);}
  for(const c of doors){
    const start=c-w/2;
    // End the plaster at the frame, not at the opening: coincident reveal
    // faces previously produced little ivory triangles in the teal jambs.
    fill(start-.154);
    solid('header',start-.154,start+w+.154,base+dh+.16,height-dh-.16,ivory,.26);
    for(const s of [-1,1]){const p=c+s*(w/2+.077);solid('jamb',p-.077,p+.077,base,dh,trim,.39);}
    solid('lintel',start-.154,start+w+.154,base+dh,.16,trim,.39);edge=start+w+.154;
  }
  fill(end);
}
for(const y of [0,UPPER]){
  const h=y===0?UPPER-.27:ROOF-UPPER-.24;
  const front=y===0?lowerFrontZ:upperFrontZ;
  wall('x',front,7,y,h,y===0?[-2.35,2.35]:[0],teal);
  wall('x',-4.5,7,y,h,[],'#934f50');
  wall('z',-7,4.5,y,h,y===0?[.05]:[-2.75],'#af685e',front);
  wall('z',7,4.5,y,h,y===0?[-2.65,.9]:[-2.7],teal,front);
}
// Side balcony at the western upper back door and glass-backed gallery.
slab('west-side',7,9.27,-4.5,1.5,UPPER,.26,'#708496');
for(const x of [-2.24,2.24]){
  block('pillar',x,0,1.94,.91,UPPER-.27,.93,'#93919c');
  block('pillar-foot',x,0,1.94,1.08,.11,1.10,'#586173');
  block('pillar-cap',x,UPPER-.48,1.94,1.14,.21,1.15,'#c8d6dd');
}
export const board=block('board',0,0,-1.67,6.57,UPPER+1.22,.24,'#aa957c');
// Under the sign is a real lower passage; no solid front wall across it.
boxes.push(...westGallery.solids);
block('west-glass',12.66,0,1.66,2.65,2.4,.16,'#577785');
block('west-bench',12.62,0,1.10,2.38,.48,.56,'#8a7970');
block('west-sign-rail',7.26,UPPER,6.32,.58,.82,.18,'#506b74');
block('lounge-kiosk',-14.15,-.68,.10,1.34,3.12,5.72,'#416967');
block('lounge-canopy',-13.42,1.84,.10,1.72,.20,5.94,'#7ca598');
block('tank-base',-13.66,2.44,-1.31,1.46,.57,1.68,'#486569');
block('tyre-rack',-11.76,-.68,-4.47,2.20,.83,.64,'#526569');
// Enclose the two side destinations at standing eye height. Beyond these
// cropped boundaries is context massing, not another playable game district.
block('east-retaining',-15.06,-.70,2.89,.24,3.18,16.08,'#738c7e');
block('east-service',-11.44,-.68,-5.64,6.74,3.32,.31,'#66847d');
block('east-service-cap',-12.48,2.64,-5.63,4.62,1.02,.32,'#50746f');
block('west-shelter-back',13.95,0,.30,.24,3.42,8.53,'#77858b');
block('west-shelter-roof',12.61,3.17,.03,2.74,.23,8.79,'#6e8389');
block('west-end-wall',10.05,0,-5.60,5.98,3.42,.23,'#77868b');
block('front-court-east',-4.88,0,12.96,4.70,2.85,.25,'#ad8e79');
block('front-court-west',4.84,0,12.96,5.50,2.72,.25,'#b07964');
export const cabinets:{x:number;y:number;z:number;side:number;style:'twin'|'fault'|'vent'}[]=[];
function cabinet(x:number,y:number,z:number,style:'twin'|'fault'|'vent'){
  const side=Math.sign(-x),w=style==='fault'?1.27:.76,h=style==='fault'?2.31:1.71;
  cabinets.push({x,y,z,side,style});block('machine',x,y,z,.71,h,w,style==='fault'?'#303644':'#485b69');
}
for(const y of [0,UPPER]){
  for(const z of [-.62,.21])cabinet(6.46,y,y===0?z-1:z,'twin');
  for(const z of [-3.72,-2.89])cabinet(-6.46,y,y===0?z:z+3.70,'vent');
}
cabinet(-6.46,UPPER,-1.10,'fault');cabinet(-6.46,0,2.08,'twin');
block('back-shutter',0,.72,-4.30,5.56,1.75,.14,'#90676b');
block('upper-shutter',0,UPPER+.72,-4.30,5.56,1.75,.14,'#90676b');

export const blocks:readonly Block[]=boxes;
export const decks=boxes.filter(b=>b.deck);
const top=(b:Block)=>b.y+b.h/2;
export const pickDecks=decks.map(b=>({x:b.x,y:top(b),z:b.z,w:b.w,d:b.d}));
const inRect=(b:Block,x:number,z:number,r=0)=>Math.abs(x-b.x)<=b.w/2+r&&Math.abs(z-b.z)<=b.d/2+r;
// Base only; the 3D motor queries slab/step triangles at the CURRENT foot y.
export function baseGround(x:number,z:number){return x> -14.84&&x<(Math.abs(z)<4.34?13.84:12.84)&&z> -5.84&&z<12.84?(x< -8?-.68:0):-Infinity;}
export function arcadePlace(x:number,y:number,z:number){
  if(![x,y,z].every(Number.isFinite))return false;
  const supported=(a:number,b:number)=>decks.some(d=>Math.abs(top(d)-y)<.002&&inRect(d,a,b));
  return [[0,0],[.18,0],[-.18,0],[0,.18],[0,-.18]].every(([a,b])=>supported(x+a,z+b))&&
    !blocks.some(b=>top(b)>y+.015&&b.y-b.h/2<y+1.72&&inRect(b,x,z,.18));
}
function intersects(start:Point,end:Point,b:Block){
  let enter=0,exit=1;
  for(const [a,size] of [['x','w'],['y','h'],['z','d']] as const){
    const delta=end[a]-start[a],lo=b[a]-b[size]/2,hi=b[a]+b[size]/2;
    if(Math.abs(delta)<1e-9){if(start[a]<lo||start[a]>hi)return false;continue;}
    const p=(lo-start[a])/delta,q=(hi-start[a])/delta;enter=Math.max(enter,Math.min(p,q));exit=Math.min(exit,Math.max(p,q));if(exit<enter)return false;
  }return true;
}
export function arcadeSight(from:Point,x:number,y:number,z:number){
  const end={x,y:y+.012,z};return from.y>end.y&& !blocks.some(b=>intersects(from,end,b));
}

// Explicit local passage: cross vertically *inside* the hole, then sideways
// above its lip (reverse order going down). Never use a jump multiplier or
// switch rooms. Test the whole body path against solids AND current actors.
export function arcadePassage(foot:Point, fits:(x:number,y:number,z:number)=>boolean){
  const down=Math.abs(foot.y-UPPER)<.08,near=down?upperPad:lowerPad;
  if(Math.abs(foot.y-near.y)>.08||Math.hypot(foot.x-near.x,foot.z-near.z)>.72)return null;
  const over={...lowerPad,y:UPPER};let p=foot;
  for(const q of down?[upperPad,over,lowerPad]:[lowerPad,over,upperPad]){
    const steps=Math.max(1,Math.ceil(Math.hypot(q.x-p.x,q.y-p.y,q.z-p.z)/.08));
    for(let i=1;i<=steps;i++){const t=i/steps;if(!fits(p.x+(q.x-p.x)*t,p.y+(q.y-p.y)*t,p.z+(q.z-p.z)*t))return null;}
    p=q;
  }return down?lowerPad:upperPad;
}
