// Nave, doorway and paved garden meet at y=0. Raised planting beds, cistern
// and cloister piers have the same footprints in rendering and placement.
export const CHAPEL = { width:11.6, length:18, shoulder:4.95, crown:8.55, bay:3 };
export const CHAPEL_BAYS = Array.from({length:6},(_,i)=>-7.5+3*i);
export const CHAPEL_PIERS = [-1,1].flatMap(side=>Array.from({length:7},(_,i)=>({x:side*5.55,z:-9+i*3,w:.58,d:.66})));
export const CHAPEL_PEWS = [-2.4,-.85,.70,2.25,3.8,5.35].flatMap(z=>[-1,1].map(side=>({x:side*2.85,z,w:2.65,d:.78})));
export const CHAPEL_DAIS = {x:0,z:-7.30,w:7.8,d:3.4};
export const CHAPEL_SUN: [number,number,number] = [-5.8,4.7,2.8];
export const GARDEN={half:13.8,front:33,back:-11.8,door:1.42};
export const CISTERN={x:0,z:24,r:2.04};
export const BEDS=[-1,1].flatMap(k=>[15,25.8].map(z=>({x:k*6.35,z,w:3.6,d:z===15?6.6:7.4})));
export const LOGGIA=[17,20,23,26,29].flatMap(z=>[-12.65,-9.9].map(x=>({x,z,w:.58,d:.58})));
export const CYPRESSES=[-1,1].flatMap(k=>[-7,-1,5].map(z=>({x:k*9.7,z,h:z===-1?5.2:6.2}))).concat([{x:9.6,z:31,h:6.8},{x:12.1,z:24,h:6.05},{x:-8.5,z:31,h:6.2}]);
export const CHAPEL_OBSTACLES = [CHAPEL_DAIS,...CHAPEL_PEWS,...CHAPEL_PIERS,...BEDS,...LOGGIA,...CYPRESSES.map(t=>({...t,w:.85,d:.85})),...[-1,1].map(s=>({x:s*1.53,z:9.68,w:.26,d:1.44}))];
export function chapelFloor(x:number,z:number){
  if(Math.abs(x)>GARDEN.half-.2||z>GARDEN.front-.24||z<GARDEN.back+.2)return false;
  const ax=Math.abs(x),az=Math.abs(z);
  if(ax<CHAPEL.width/2-.12&&az<CHAPEL.length/2-.12)return true;
  if(z>8.55&&z<9.6&&ax<GARDEN.door-.06)return true;
  return (ax>CHAPEL.width/2+.72||az>CHAPEL.length/2+.23)&&Math.hypot(x-CISTERN.x,z-CISTERN.z)>CISTERN.r+.06;
}
export const CHAPEL_SHOTS=[
  {key:'chapelWindow',eye:[-2.0,1.61,-.15],aim:[-5.78,2.65,-1.57]},
  {key:'chapelDoor',eye:[.54,1.61,5.85],aim:[-.06,1.53,17.0]},
  {key:'chapelGarden',eye:[2.95,1.62,17.8],aim:[-.67,1.38,25.6]},
  {key:'chapelFacade',eye:[6.15,2.04,29.9],aim:[0,4.6,8.2]},
] as const;
