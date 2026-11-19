import type { Part } from './SceneryBatch';
export type CampusRoom='classroom'|'lawn';
export const CAMPUS_OFFSET={x:14,z:-6.8}; // class origin in the meadow's coordinate system
export const CAMPUS_DOOR=-3.65;
export function nearCampusDoor(x:number,z:number){return x< -2.52&&x> -10.8&&z>4.7&&z<8.51;}
export function classPassageFloor(x:number,z:number){
  return Math.abs(x-CAMPUS_DOOR)<.81&&z>5.35&&z<7.05 || x>=-8.61&&x<=-2.55&&z>=6.14&&z<=8.26;
}
export function lawnSchoolFoot(x:number,z:number){return Math.abs(x-CAMPUS_OFFSET.x)<5.65&&Math.abs(z-CAMPUS_OFFSET.z)<5.79;}
export function lawnPaving(x:number,z:number){return lawnSchoolFoot(x,z)||x>3.36&&x<11.91&&z>-.96&&z<1.80;}
export function passagePost(room:CampusRoom,x:number,z:number){if(room==='lawn'){x-=CAMPUS_OFFSET.x;z-=CAMPUS_OFFSET.z;}return Math.abs(Math.abs(z-7.22)-1.20)<.27&&[-10.38,-7.22,-2.45].some(u=>Math.abs(x-u)<.27);}

/** The same breezeway is drawn on both sides of the loading seam, in the
 * active room's coordinate system. Use its existing wood/trim batch. */
export function campusPassageParts(room:CampusRoom):Part[]{
  const dx=room==='lawn'?CAMPUS_OFFSET.x:0,dz=room==='lawn'?CAMPUS_OFFSET.z:0,parts:Part[]=[];
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>parts.push({p:[x+dx,y,z+dz],s:[w,h,d],color});
  box(-6.46,-.069,7.22,8.3,.14,2.57,'#c5b397');box(CAMPUS_DOOR,-.062,5.89,1.83,.125,.94,'#cfbda2');
  for(const sign of [-1,1]){const z=7.22+sign*1.20;box(-6.46,2.76,z,8.50,.17,.12,'#769087');
    for(const x of [-10.38,-7.22,-2.45]){box(x,1.36,z,.13,2.72,.13,'#768d80');box(x,.12,z,.19,.24,.19,'#9c9f8d');}}
  for(let i=0;i<14;i++)box(-10.41+i*.60,2.89,7.22,.09,.11,2.75,'#b49368');
  box(-6.45,2.99,7.22,8.58,.10,2.85,'#c3c9ac');
  for(let i=0;i<8;i++){const x=-9.96+i;box(x,.002,7.22,.014,.004,2.32,'#a69e89');}
  // Flush entry arrows on glazed tiles, and a hanging brass-framed sign.
  for(const k of [-1,1])parts.push({p:[-8.18+dx,.009,7.22+dz+k*.093],s:[.31,.01,.046],ry:k*-.54,color:'#427f78'});
  box(-9.51,2.42,7.22,.069,.36,1.21,'#476c66');box(-9.51,2.61,7.22,.083,.04,1.25,'#c4a573');
  for(const s of [-1,1]){box(-9.51+s*.038,2.42,7.22,.018,.026,.47,'#fff0cc');for(const k of [-1,1])parts.push({p:[-9.51+dx+s*.04,2.42+k*.055,7.22+dz+s*.17],s:[.018,.04,.18],rx:k*s*.62,color:'#fff0cc'});}
  for(const z of [6.80,7.64])box(-9.51,2.72,z,.024,.24,.024,'#736e56');
  return parts;
}
export function classroomDistantArbor():Part[]{const parts:Part[]=[];
  const x=-18.24,z=.4;for(const k of [-1,1])for(const s of [-1,1])parts.push({p:[x+k*1.53,1.32,z+s*1.16],s:[.17,2.64,.17],color:'#a08861'});
  for(const k of [-1,1])parts.push({p:[x+k*1.53,2.67,z],s:[.16,.21,3.24],color:'#ae956b'});
  for(let i=0;i<9;i++){const zz=z+(i-4)*.37;parts.push({p:[x,2.82,zz],s:[3.74,.14,.095],color:'#b89c76'});
    for(const k of [-1,1])parts.push({p:[x+k*(1.18+.2*Math.sin(i)),2.61,zz],s:[.34,.32+.17*Math.cos(i),.29],color:i%3?'#af93b4':'#90a378'});}return parts;
}
export function schoolExterior():Part[]{const parts:Part[]=[];const box=(x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>parts.push({p:[x+14,y,z-6.8],s:[w,h,d],color});
  box(0,1.79,0,10.8,3.58,11.2,'#dbc6a8');box(0,3.62,0,11.2,.22,11.55,'#709284');box(0,3.79,0,11.33,.11,11.66,'#c1c5b5');
  for(const k of [-1,1]){const x=k*5.42;box(x,1.99,0,.08,2.28,10.80,'#94b2b0');box(k*5.49,.86,0,.24,.16,11.19,'#e4d5b9');box(k*5.49,2.65,0,.11,.067,11.19,'#b9c8bc');
    for(let i=0;i<10;i++)box(k*5.50,2.01,-5.4+i*1.12,.14,2.27,i%2?.06:.15,'#dacbb1');}
  box(CAMPUS_DOOR,1.21,5.61,1.85,2.43,.055,'#546a61');box(CAMPUS_DOOR,2.57,5.63,2.11,.15,.13,'#c6ae85');return parts;
}
