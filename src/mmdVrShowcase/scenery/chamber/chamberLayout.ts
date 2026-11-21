import {nearEffigy,effigyOccludes} from './effigyShape';

// Metres. The porphyry dais is let into the vault pavement: both stages are Y=0.
export const HALL={half:3.45,front:4.55,back:-7.45,spring:2.50,rise:1.77};
export const PORTAL={x:.64,z:-2.04,r:1.06,spring:1.66,rise:.96,depth:.56};
export const CELL={x:HALL.half,z:-4.81,w:2.04,depth:1.08,top:2.18};
export const DAIS={x:-.54,z:-5.74,w:3.28,d:2.36};
export const RIBS=[3.90,.86,-4.14,-7.12];
export type Block={x:number;z:number;w:number;d:number;lo:number;hi:number};
const block=(x:number,z:number,w:number,d:number,hi:number,lo=0):Block=>({x,z,w,d,hi,lo});
export const WHEEL=block(-2.76,-3.39,.70,1.62,1.91),BOARD=block(-2.75,-5.99,.66,1.54,1.59);
export const DESK=block(-1.77,.82,2.04,1.00,.84), STOOL=block(-2.07,-.13,.51,.49,.48);
export const PRESS=block(2.99,1.16,.66,1.60,1.48), BENCH=block(-3.05,-4.79,.64,1.54,1.10);
export const READERS=[block(-2.28,-6.96,.48,.43,1.22),block(1.19,-6.96,.48,.43,1.22)];
const piers=RIBS.flatMap(z=>[-1,1].map(s=>block(s*(HALL.half-.135),z,.27,.42,HALL.spring)));
const contents=[DESK,STOOL,PRESS,BENCH,WHEEL,BOARD,...READERS,...piers];
const ribs=RIBS.map(z=>({z,r:HALL.half-.21,spring:HALL.spring,rise:HALL.rise-.14,depth:.30,x:0}));
export const chamberEntry={x:.91,z:3.68};
export const chamberView={entry:[[chamberEntry.x,1.58,chamberEntry.z],[-.47,1.30,-1.12]],shots:[
  {key:'chamberRecord',eye:[-.57,1.48,2.38],aim:[-1.81,.96,.55]},
  {key:'chamberVault',eye:[-1.40,1.56,-3.00],aim:[1.21,1.21,-6.07]},
  {key:'chamberWheel',eye:[.92,1.54,-4.05],aim:[-2.69,1.03,-4.46]},
  {key:'chamberTown',eye:[-1.48,1.61,2.28],aim:[-9.4,1.90,2.18]},
]} as const;

function within(b:Block,x:number,z:number,pad:number){return Math.abs(x-b.x)<=b.w/2+pad&&Math.abs(z-b.z)<=b.d/2+pad;}
function clear(x:number,z:number,pad:number){
  if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>HALL.half-pad||z>HALL.front-pad||z<HALL.back+pad)return false;
  if(Math.abs(z-PORTAL.z)<=PORTAL.depth/2+pad&&Math.abs(x-PORTAL.x)>=PORTAL.r-pad)return false;
  return !nearEffigy(x,z,pad)&&!contents.some(b=>within(b,x,z,pad));
}
export const chamberPlace=(x:number,z:number)=>clear(x,z,.23);
export const chamberGround=(x:number,z:number)=>clear(x,z,.16)?0:-Infinity;

type Eye={x:number;y:number;z:number};
function clip(a:number,b:number,min:number,max:number,range:[number,number]){
  const d=b-a;if(Math.abs(d)<1e-9)return a>=min&&a<=max;
  const l=(min-a)/d,r=(max-a)/d;
  range[0]=Math.max(range[0],Math.min(l,r));range[1]=Math.min(range[1],Math.max(l,r));return range[0]<=range[1];
}
function under(x:number,y:number,r:number,spring:number,rise:number){
  return Math.abs(x)<r && y<spring+rise*Math.sqrt(Math.max(0,1-(x/r)**2));
}
const deskside=[...contents,block(DESK.x+.02,DESK.z,.63,.43,.93,.84),block(DESK.x-.74,DESK.z-.27,.20,.20,1.28,.84)];
export function chamberSight(from:Eye,x:number,y:number,z:number){
  if(![from.x,from.y,from.z,x,y,z].every(Number.isFinite)||from.y<=y||from.y<0||y<-.015)return false;
  // The barred recess and windows have no supported point on the far side.
  for(const [a,b,h] of [[from.x,from.z,from.y],[x,z,y]])if(Math.abs(a)>=HALL.half||b<=HALL.back||b>=HALL.front||!under(a,h,HALL.half,HALL.spring,HALL.rise))return false;
  for(const arch of [PORTAL,...ribs]){
    const range:[number,number]=[0,1];if(!clip(from.z,z,arch.z-arch.depth/2,arch.z+arch.depth/2,range))continue;
    // The under-arch volume is convex; both ends of the clipped segment must be inside it.
    for(const t of range)if(!under(from.x+(x-from.x)*t-arch.x,from.y+(y-from.y)*t,arch.r,arch.spring,arch.rise))return false;
  }
  return !effigyOccludes(from,x,y,z)&&!deskside.some(b=>{const t:[number,number]=[0,1];return clip(from.x,x,b.x-b.w/2,b.x+b.w/2,t)&&clip(from.z,z,b.z-b.d/2,b.z+b.d/2,t)&&clip(from.y,y,b.lo,b.hi,t);});
}
