import {ROOM} from './ClassroomLayout';
import {ARBOR} from './meadowLandmarks';
import type {Part} from './SceneryBatch';

type Room='classroom'|'lawn';
type XZ=readonly [number,number];
export const CAMPUS_OFFSET={x:9,z:-13.3};
export const CAMPUS_DOOR=-4.03;
const rear=ROOM.d/2;
export const SCHOOL_GATE={out:rear+.36,in:rear-.12,half:.86};
// Rear aisle → porch → brick path. Local classroom metres, also used by the meadow proxy.
export const SCHOOL_PATH:readonly XZ[]=[[CAMPUS_DOOR,rear-.01],[CAMPUS_DOOR,6.64],[-5.22,7.54],[-7.20,8.29],[-8.75,9.68],[-10.98,11.51]];
export const SCHOOL_PATH_WIDTH=2.04;
function pathDistance(x:number,z:number){let d=Infinity;
  for(let i=1;i<SCHOOL_PATH.length;i++){
    const [a,b]=SCHOOL_PATH[i-1],[c,e]=SCHOOL_PATH[i],u=c-a,v=e-b,t=Math.max(0,Math.min(1,((x-a)*u+(z-b)*v)/(u*u+v*v)));
    d=Math.min(d,Math.hypot(x-a-t*u,z-b-t*v));
  }return d;
}
export function nearCampusDoor(x:number,z:number){return Math.abs(x-CAMPUS_DOOR)<2&&z>3.6;}
export function classPassageFloor(x:number,z:number){return (z>=rear-.36&&z<rear+.2)?Math.abs(x-CAMPUS_DOOR)<.86:z>=rear+.2&&pathDistance(x,z)<SCHOOL_PATH_WIDTH/2;}
export function lawnSchoolFoot(x:number,z:number){x-=CAMPUS_OFFSET.x;z-=CAMPUS_OFFSET.z;
  return Math.abs(x)<ROOM.w/2+.20&&Math.abs(z)<rear+.19&&!(Math.abs(x-CAMPUS_DOOR)<.86&&z>rear-.65);
}
export function lawnPaving(x:number,z:number,margin=0){return Math.abs(x-CAMPUS_OFFSET.x)<ROOM.w/2+.2+margin&&Math.abs(z-CAMPUS_OFFSET.z)<rear+.2+margin||pathDistance(x-CAMPUS_OFFSET.x,z-CAMPUS_OFFSET.z)<SCHOOL_PATH_WIDTH/2+.22+margin;}
const screenX=CAMPUS_DOOR+1.38;
export function passagePost(room:Room,x:number,z:number){if(room==='lawn'){x-=CAMPUS_OFFSET.x;z-=CAMPUS_OFFSET.z;}
  return Math.abs(x-screenX)<.31&&Math.abs(z-6.77)<1.24 || Math.abs(x-CAMPUS_DOOR+1.40)<.30&&Math.abs(z-6.04)<.33;
}
export function campusPassageParts(room:Room):Part[]{
  const dx=room==='lawn'?CAMPUS_OFFSET.x:0,dz=room==='lawn'?CAMPUS_OFFSET.z:0,out:Part[]=[];
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,color:string,ry=0,rx=0)=>out.push({p:[x+dx,y,z+dz],s:[w,h,d],ry,rx,color});
  const birch='#c79f71',iron='#485e58';
  // A small lean-to grows out of the teaching block, closed only on its service side.
  box(CAMPUS_DOOR,2.87,6.63,3.33,.13,2.69,'#6d8276',0,.09);
  box(CAMPUS_DOOR,2.69,7.94,3.44,.19,.12,iron);
  for(let i=0;i<10;i++)box(CAMPUS_DOOR-1.48+i*.33,2.80,6.67,.054,.095,2.60,birch,0,.09);
  for(const [x,z] of [[screenX,7.45],[CAMPUS_DOOR-1.40,6.04]]){box(x,1.34,z,.115,2.68,.16,iron);box(x,.14,z,.22,.28,.23,'#b5aa91');}
  box(screenX,.35,6.72,.24,.70,1.98,'#b68369');
  for(let i=0;i<11;i++)box(screenX,1.69,5.84+i*.178,.085,1.98,.072,birch);
  box(screenX,1.56,6.77,.11,.065,2.08,iron);
  box(CAMPUS_DOOR+.91,2.25,6.02,.34,.13,.24,iron);box(CAMPUS_DOOR+.91,2.15,6.02,.28,.09,.18,'#fff0c5');
  return out;
}
export function classroomDistantArbor():Part[]{
  const parts:Part[]=[],x=ARBOR.x-CAMPUS_OFFSET.x,z=ARBOR.z-CAMPUS_OFFSET.z;
  for(const k of [-1,1])for(const s of [-1,1])parts.push({p:[x+k*1.53,1.32,z+s*1.16],s:[.17,2.64,.17],color:'#a08861'});
  for(let i=0;i<9;i++){const zz=z+(i-4)*.37;parts.push({p:[x,2.82,zz],s:[3.74,.14,.095],color:'#b89c76'});
    for(const k of [-1,1])parts.push({p:[x+k*(1.18+.2*Math.sin(i)),2.61,zz],s:[.34,.32+.17*Math.cos(i),.29],color:i%3?'#af93b4':'#90a378'});}return parts;
}
export function schoolExterior():Part[]{const parts:Part[]=[];
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>parts.push({p:[x+CAMPUS_OFFSET.x,y,z+CAMPUS_OFFSET.z],s:[w,h,d],color});
  const X=ROOM.w/2,H=ROOM.h;
  for(const [a,b] of [[-X,CAMPUS_DOOR-.93],[CAMPUS_DOOR+.93,X]]){
    box((a+b)/2,H/2,rear+.08,b-a,H,.16,'#d9c6a7');box((a+b)/2,.48,rear+.12,b-a,.96,.16,'#a4b5a1');
  }
  box(CAMPUS_DOOR,(H+2.4)/2,rear+.08,1.86,H-2.4,.16,'#dfcfb1');
  box(0,H/2,-rear,ROOM.w,H,.18,'#d5c3a9');box(0,-.056,0,ROOM.w,.14,ROOM.d,'#bc9b74');
  box(0,H+.10,0,ROOM.w+.42,.20,ROOM.d+.40,'#758d80');
  for(const s of [-1,1]){box(s*X,H/2,0,.14,H,ROOM.d,'#d9c6a7');box(s*(X+.08),2.03,0,.048,1.93,ROOM.d-.25,'#91adac');
    for(let i=0;i<10;i++)box(s*(X+.12),2.04,-5.02+i*1.12,.095,2.02,i%2?.057:.13,'#dacbb1');}
  box(-.7,1.97,-rear+.13,5.94,1.49,.09,'#465a51');
  for(const z of [-3,-1.1,.8,2.7])for(const x of [-3.2,-2.25,2.05,3.0])box(x,.71,z,.86,.065,.56,'#bc9570');
  return parts;
}
